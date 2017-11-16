require('./Base');
require('../Helpers/ColourHelper');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;
YeColorLEDBulb = function(platform, config) {
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
        this.accessories['LightAccessory'] = new YeColorLEDBulbServices(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[ColorLEDBulb][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    
    return accessoriesArr;
}
inherits(YeColorLEDBulb, Base);

YeColorLEDBulbServices = function(dThis) {
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

YeColorLEDBulbServices.prototype.getServices = function() {
    var that = this;
    var services = [];
    var tokensan = this.token.substring(this.token.length-8);
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "Yeelight")
        .setCharacteristic(Characteristic.Model, "ColorLEDBulb")
        .setCharacteristic(Characteristic.SerialNumber, tokensan);
    services.push(infoService);   
    var ColorLEDBulbService = this.Lampservice = new Service.Lightbulb(this.name);
    
    
    var ColorLEDBulbOnCharacteristic = ColorLEDBulbService.getCharacteristic(Characteristic.On);
    ColorLEDBulbOnCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["power"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - getPower: " + result);
                callback(null, result[0] === 'on' ? true : false);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDBulb - getPower Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.device.call("set_power", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - setPower Result: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDBulb - setPower Error: " + err);
                callback(err);
            });
        }.bind(this));
    ColorLEDBulbService
        .addCharacteristic(Characteristic.Hue)
        .setProps({
            minValue: 0,
            maxValue: 360,
            minStep: 1
        });     
    ColorLEDBulbService
        .addCharacteristic(Characteristic.Brightness)
        .on('get', function(callback) {
            this.device.call("get_prop", ["bright"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - getBrightness: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDBulb - getBrightness Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            if(value > 0) {
                this.device.call("set_bright", [value]).then(result => {
                    that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - setBrightness Result: " + result);
                    if(result[0] === "ok") {
                        callback(null);
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[ReYeelight][ERROR]ColorLEDBulb - setBrightness Error: " + err);
                    callback(err);
                });
            } else {
                callback(null);
            }
        }.bind(this));
    ColorLEDBulbService
        .getCharacteristic(Characteristic.Hue)
        .on('get', function(callback) {
            this.device.call("get_prop", ["rgb"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - getRGB: " + result);
                rgb = this.ColourHelper.argb2rgb(result[0]);
                hsb = this.ColourHelper.rgb2hsb(rgb);
                this.hue = hsb[0];
                callback(null, hsb[0]);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDBulb - getRGB Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            this.hue = value;
            rgb = this.ColourHelper.hsv2argb(parseFloat(value/360), parseFloat(this.sat/100), parseFloat(this.ct/100));
            that.platform.log.debug("[ReYeelight][ERROR]ColorLEDBulb - setRGB " + rgb + " From " + value);
            this.device.call("set_rgb", [rgb]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - setRGBResult: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDBulb - setRGB Error: " + err);
                callback(err);
            });
        }.bind(this));
    ColorLEDBulbService
        .addCharacteristic(Characteristic.Saturation)
        .on('get', function(callback) {
            that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - getSAT: " + this.sat);
            this.device.call("get_prop", ["sat"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - getSaturation: " + result);
                this.sat = result[0];
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDBulb - getSaturation Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            this.sat = value;
            rgb = this.ColourHelper.hsv2argb(parseFloat(this.hue/360), parseFloat(value/100), parseFloat(this.ct/100));
            that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - setSaturation " + rgb + " From Saturation " + value);
            that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - setSAT: " + this.sat);
            this.device.call("set_rgb", [rgb]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - setSaturationResult: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDBulb - setSaturation Error: " + err);
                callback(err);
            });
        }.bind(this));    
    services.push(ColorLEDBulbService);
    return services;
}

YeColorLEDBulbServices.prototype.updateTimer = function() {
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

YeColorLEDBulbServices.prototype.runTimer = function() {
    var that = this;
    this.device.call("get_prop", ["power","bright","ct","rgb","sat"]).then(result => {
        that.platform.log.debug("[ReYeelight][" + this.name + "][DEBUG]ColorLEDBulb - getPower: " + result[0]);
        this.Lampservice.getCharacteristic(Characteristic.On).updateValue(result[0] === 'on' ? true : false);
        that.platform.log.debug("[ReYeelight][" + this.name + "][DEBUG]ColorLEDBulb - getBrightness: " + result[1]);
        this.Lampservice.getCharacteristic(Characteristic.Brightness).updateValue(result[1]);
        that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - getRGB: " + result[3]);
        rgb = this.ColourHelper.argb2rgb(result[3]);
        hsb = this.ColourHelper.rgb2hsb(rgb);
        this.hue = hsb[0];
        this.Lampservice.getCharacteristic(Characteristic.Hue).updateValue(this.hue);
        that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - getHue: " + this.hue);
        this.sat = result[4];
        this.Lampservice.getCharacteristic(Characteristic.Saturation).updateValue(this.sat);
        that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDBulb - getSaturation: " + this.sat);        
    }).catch(function(err) {
        if(err == "Error: Call to device timed out"){
            that.platform.log.debug("[ReYeelight][ERROR]ColorLEDBulb - Lamp Offline");
        }else{
            that.platform.log.error("[ReYeelight][" + this.name + "][ERROR]ColorLEDBulb - Update Error: " + err);
        }
    });
}
