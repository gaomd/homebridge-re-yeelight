require('./Base');
require('../Helpers/ColourHelper');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;
YeWhiteBulb = function(platform, config) {
    this.init(platform, config);
    
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    
    this.device = new miio.Device({
        address: this.config['ip'],
        token: this.config['token']
    });
    
    this.accessories = {};
    if(this.config['Name'] && this.config['Name'] != "") {
        this.accessories['WaterAccessory'] = new YeWhiteBulbServices(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[WhiteBulb][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    
    return accessoriesArr;
}
inherits(YeWhiteBulb, Base);

YeWhiteBulbServices = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['Name'];
    this.token = dThis.config['token'];
    this.platform = dThis.platform;
    this.sat = 100;
    this.hue = 360;
    this.ct = 100;
    this.updatetimere = dThis.config["updatetimer"];
    this.interval = dThis.config["interval"];
    if(this.interval == null){
        this.interval = 3;
    }
    this.Lampservice = false;
    this.timer;
    if(this.updatetimere === true){
        this.updateTimer();
    }
    this.ColourHelper = new ColourHelper();
}

YeWhiteBulbServices.prototype.getServices = function() {
    var that = this;
    var services = [];
    var tokensan = this.token.substring(this.token.length-8);
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "Yeelight")
        .setCharacteristic(Characteristic.Model, "WhiteBulb")
        .setCharacteristic(Characteristic.SerialNumber, tokensan);
    services.push(infoService);   
    var WhiteBulbService = this.Lampservice = new Service.Lightbulb(this.name);
    var WhiteBulbOnCharacteristic = WhiteBulbService.getCharacteristic(Characteristic.On);
    WhiteBulbOnCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["power"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]WhiteBulb - getPower: " + result);
                callback(null, result[0] === 'on' ? true : false);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]WhiteBulb - getPower Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.device.call("set_power", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]WhiteBulb - setPower Result: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]WhiteBulb - setPower Error: " + err);
                callback(err);
            });
        }.bind(this)); 
    WhiteBulbService
        .addCharacteristic(Characteristic.Brightness)
        .on('get', function(callback) {
            this.device.call("get_prop", ["bright"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]WhiteBulb - getBrightness: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]WhiteBulb - getBrightness Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            if(value > 0) {
                this.device.call("set_bright", [value]).then(result => {
                    that.platform.log.debug("[ReYeelight][DEBUG]WhiteBulb - setBrightness Result: " + result);
                    if(result[0] === "ok") {
                        callback(null);
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[ReYeelight][ERROR]WhiteBulb - setBrightness Error: " + err);
                    callback(err);
                });
            } else {
                callback(null);
            }
        }.bind(this));
    services.push(WhiteBulbService);
    return services;
}

YeWhiteBulbServices.prototype.updateTimer = function() {
    if (this.updatetimere) {
        clearTimeout(this.timer);
        this.timer = setTimeout(function() {
            if(this.Lampservice !== false){
                this.runTimer();
            }
            this.updateTimer();
        }.bind(this), this.interval * 1000);
    }
}

YeWhiteBulbServices.prototype.runTimer = function() {
    var that = this;
    this.device.call("get_prop", ["power","bright"]).then(result => {
        that.platform.log.debug("[ReYeelight][" + this.name + "][DEBUG]WhiteBulb - getPower: " + result[0]);
        this.Lampservice.getCharacteristic(Characteristic.On).updateValue(result[0] === 'on' ? true : false);
        that.platform.log.debug("[ReYeelight][" + this.name + "][DEBUG]WhiteBulb - getBrightness: " + result[1]);
        this.Lampservice.getCharacteristic(Characteristic.Brightness).updateValue(result[1]);    
    }).catch(function(err) {
        if(err == "Error: Call to device timed out"){
            that.platform.log.debug("[ReYeelight][ERROR]WhiteBulb - Lamp Offline");
        }else{
            that.platform.log.error("[ReYeelight][" + this.name + "][ERROR]WhiteBulb - Update Error: " + err);
        }
    });
}
