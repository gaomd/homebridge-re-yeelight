require('./Base');
require('../Helpers/ColourHelper');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;
YeColorLEDStrip = function(platform, config) {
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
        this.accessories['WaterAccessory'] = new YeYeColorLEDStripServices(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[ColorLEDStrip][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    
    return accessoriesArr;
}
inherits(YeColorLEDStrip, Base);

YeColorLEDStripServices = function(dThis) {
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

YeColorLEDStripServices.prototype.getServices = function() {
    var that = this;
    var services = [];
    var tokensan = this.token.substring(this.token.length-8);
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "Yeelight")
        .setCharacteristic(Characteristic.Model, "ColorLEDStrip")
        .setCharacteristic(Characteristic.SerialNumber, tokensan);
    services.push(infoService);   
    var ColorLEDStripService = this.Lampservice = new Service.Lightbulb(this.name);
    var ColorLEDStripOnCharacteristic = ColorLEDStripService.getCharacteristic(Characteristic.On);
    ColorLEDStripOnCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["power"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - getPower: " + result);
                callback(null, result[0] === 'on' ? true : false);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDStrip - getPower Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.device.call("set_power", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - setPower Result: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDStrip - setPower Error: " + err);
                callback(err);
            });
        }.bind(this));
    ColorLEDStripService
        .addCharacteristic(Characteristic.Hue)
        .setProps({
            minValue: 0,
            maxValue: 360,
            minStep: 1
        });     
    ColorLEDStripService
        .addCharacteristic(Characteristic.Brightness)
        .on('get', function(callback) {
            this.device.call("get_prop", ["bright"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - getBrightness: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDStrip - getBrightness Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            if(value > 0) {
                this.device.call("set_bright", [value]).then(result => {
                    that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - setBrightness Result: " + result);
                    if(result[0] === "ok") {
                        callback(null);
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[ReYeelight][ERROR]ColorLEDStrip - setBrightness Error: " + err);
                    callback(err);
                });
            } else {
                callback(null);
            }
        }.bind(this));
    ColorLEDStripService
        .getCharacteristic(Characteristic.Hue)
        .on('get', function(callback) {
            this.device.call("get_prop", ["rgb"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - getRGB: " + result);
                rgb = this.ColourHelper.argb2rgb(result[0]);
                hsb = this.ColourHelper.rgb2hsb(rgb);
                this.hue = hsb[0];
                callback(null, hsb[0]);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDStrip - getRGB Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            this.hue = value;
            rgb = this.ColourHelper.hsv2argb(parseFloat(value/360), parseFloat(this.sat/100), parseFloat(this.ct/100));
            that.platform.log.debug("[ReYeelight][ERROR]ColorLEDStrip - setRGB " + rgb + " From " + value);
            this.device.call("set_rgb", [rgb]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - setRGBResult: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDStrip - setRGB Error: " + err);
                callback(err);
            });
        }.bind(this));
    ColorLEDStripService
        .addCharacteristic(Characteristic.Saturation)
        .on('get', function(callback) {
            this.device.call("get_prop", ["sat"]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - getSaturation: " + result);
                this.sat = result[0];
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDStrip - getSaturation Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            this.sat = value;
            rgb = this.ColourHelper.hsv2argb(parseFloat(this.hue/360), parseFloat(value/100), parseFloat(this.ct/100));
            that.platform.log.debug("[ReYeelight][ERROR]ColorLEDStrip - setSaturation " + rgb + " From Saturation " + value);
            this.device.call("set_rgb", [rgb]).then(result => {
                that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - setSaturationResult: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[ReYeelight][ERROR]ColorLEDStrip - setSaturation Error: " + err);
                callback(err);
            });
        }.bind(this));    
    services.push(ColorLEDStripService);
    return services;
}

YeColorLEDStripServices.prototype.updateTimer = function() {
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

YeColorLEDStripServices.prototype.runTimer = function() {
    var that = this;
    this.device.call("get_prop", ["power","bright","ct","rgb","sat"]).then(result => {
        that.platform.log.debug("[ReYeelight][" + this.name + "][DEBUG]ColorLEDStrip - getPower: " + result[0]);
        this.Lampservice.getCharacteristic(Characteristic.On).updateValue(result[0] === 'on' ? true : false);
        that.platform.log.debug("[ReYeelight][" + this.name + "][DEBUG]ColorLEDStrip - getBrightness: " + result[1]);
        this.Lampservice.getCharacteristic(Characteristic.Brightness).updateValue(result[1]);
        that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - getRGB: " + result[3]);
        rgb = this.ColourHelper.argb2rgb(result[3]);
        hsb = this.ColourHelper.rgb2hsb(rgb);
        this.hue = hsb[0];
        this.Lampservice.getCharacteristic(Characteristic.Hue).updateValue(this.hue);
        that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - getHue: " + this.hue);
        this.sat = result[4];
        this.Lampservice.getCharacteristic(Characteristic.Saturation).updateValue(this.sat);
        that.platform.log.debug("[ReYeelight][DEBUG]ColorLEDStrip - getSaturation: " + this.sat);        
    }).catch(function(err) {
        if(err == "Error: Call to device timed out"){
            that.platform.log.debug("[ReYeelight][ERROR]ColorLEDStrip - Lamp Offline");
        }else{
            that.platform.log.error("[ReYeelight][" + this.name + "][ERROR]ColorLEDStrip - Update Error: " + err);
        }
    });
}

