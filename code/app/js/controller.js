/* global API, log, Params */
const MAX_VALUE = 4095;
const GET_RELAY  = 0x0001;
const GET_TRANS  = 0x0002;
const GET_BRIGHT = 0x0004;
const GET_CHS    = 0x8000;
const GET_CH0    = 0x0010;
const GET_CH1    = 0x0020;
const GET_CH2    = 0x0040;
const GET_CH3    = 0x0080;
const GET_CH0123 = 0x00F0;
const GET_SL_BR  = 0x0100;
const GET_SL_CO  = 0x0200;
const GET_SL_DI  = 0x0400;
const GET_SL_NOR = 0x0800;
const GET_SL_GAM = 0x1000;
const GET_SLIDERS= 0x1F00;
const GET_ALL    = GET_RELAY | GET_TRANS | GET_BRIGHT | GET_SLIDERS;

//const YELLOW_CHANNELS = [0,3];
//const WHITE_CHANNELS = [1,2];
//const TOP_CHANNELS = [2,3];
//const BOTTOM_CHANNELS = [0,1];
const CHANNELS_ID = [0,1,2,3];

class Controller
{
  constructor(id)
  {
    this.id = id;
    this.name = "Light";
    this.ip = "0.0.0.0";
    this.apikey = "";
    this.brightness = -1;
    this.direction = MAX_VALUE / 2;
    this.normalized = false;
    this.transition = 0;
    this.updating = 0;
    this.channels = [-1,-1,-1,-1];
    this.maxBrightness = MAX_VALUE / 2;
    this.APIfails = 0;
    this.APIRequests = 0;
    this.nextRequestTimer = null;
    this.gamma = 1.0;
    this.status = { on:false, offline:true, trygoonline:false };
    this.button = { div:null, title:null, power:null, loading:null };
    var url = new URL(document.location.href);
    if(url && url.hostname && url.hostname.split(".").length===4 && !isNaN(parseInt(url.hostname.split(".")[3]))) this.ip = url.hostname;
  }
  
  GetChannels()
  {
    return this.channels;
  }
  
  GetBrightness()
  {
    return this.maxBrightness;
  }
  
  GetDirection()
  {
    return this.direction;
  }
  
  GetTransition()
  {
    return this.transition;
  }
  
  GetStatus()
  {
    return this.status;
  }
  
  PowerOnOff(func)
  {
    this.UpdateUIButton(Controllers.activeController===this, 1.0);
    API.SendOnOff(this.ip, this.apikey, !this.status.on, (a)=>{
      var j = JSON.parse(a);
      if(j && !isNaN(parseInt(j["relay/0"]))) 
      {
        this.status.on = parseInt(j["relay/0"]) > 0;
        func(this.status.on);
      }
      this.UpdateUIButton(Controllers.activeController===this, 0.0);
    });
  }
  
  GotGetAnswer(a, param, mask)
  {
    try
    {
      var j = JSON.parse(a);
      if(j["error"]) 
      {
        //console.log(j);
        //console.error(j["error"] + "\n" + this.ip); 
        AddToLog("<p style='color:darkred'>" + j['error'] + "-" + this.ip + "</p>");
        this.status.offline = true;
        this.status.trygoonline = false;
      }
      else           
      {
        switch(param)
        {
          case "relay/0" :    this.status.on = (j[param] === 1); break;
          case "transition" : this.transition = parseInt(j[param]); break;
          case "brightness" : if(parseInt(j[param]) < MAX_VALUE)
                              {
                                API.SendBrightness(this.ip, this.apikey, MAX_VALUE, (a)=>{
                                  var j = JSON.parse(a);
                                  if(j && !isNaN(parseInt(j["brightness"]))) this.brightness = parseInt(j["brightness"]);
                                }); 
                              }
                              else
                              {
                                this.brightness = parseInt(j["brightness"]);
                              }
                              break;
          case "sl_bright"  : this.maxBrightness = parseInt(j[param]); break;
          case "sl_color"   : Controllers.balance = parseInt(j[param]); break;
          case "sl_dir"     : this.direction = parseInt(j[param]); break;
          case "sl_nor"     : this.normalize = parseInt(j[param]) > 0; break;
          case "sl_gamma"   : this.gamma = parseInt(j[param]) / 100.0; break;
          case "transition" : this.transition = parseInt(j[param]); break;
          case "channels"   : var chls = j[param];
                              if(chls.length >= 12)
                              {
                                for(var j=0;j<4;j++)
                                {
                                  var hex = chls.substring(j*3, j*3+3);
                                  var int = parseInt(hex, 16);
                                  if(isNaN(int)) AddToLog("<p>Unable to parse channel " + j + ", value " + hex + " (" + int + ")</p>");
                                  else this.channels[j] = int;
                                }
                              }
                              break; 
          case "channel/" + CHANNELS_ID[0] :  this.channels[0] = j[param]; break;
          case "channel/" + CHANNELS_ID[1] :  this.channels[1] = j[param]; break;
          case "channel/" + CHANNELS_ID[2] :  this.channels[2] = j[param]; break;
          case "channel/" + CHANNELS_ID[3] :  this.channels[3] = j[param]; break;
        }
      }
    }
    catch(err)
    {
      AddToLog("<p> Can't go online: " + err + "</p>");
      this.status.trygoonline = false;
      this.status.offline = true;
    }
    this.APIRequests--;
    if(this.APIRequests <= 0)
    {
      AddToLog("<i>GOT ALL DATA</i><hr>");
      
      if(mask === GET_ALL && !this.status.trygoonline && ++this.APIfails < 10)
      {
        setTimeout(()=>{this.GetData(mask);}, 1000 - this.APIfails*50);
      }
      else if(this.status.offline && this.status.trygoonline)
      {
        this.status.offline = false;
      }
      
      this.UpdateUIButton(Controllers.activeController===this, 0.0);
            
      if(mask === GET_ALL || mask === GET_RELAY)
      {
        //this.maxBrightness = Math.max(this.channels[YELLOW_CHANNELS[0]], this.channels[WHITE_CHANNELS[0]]);
        Controllers.UpdateUI();
      }
      else
      {
        Controllers.UpdateUIController(this);
      }
    }
  }
  
  GetData(mask)
  {
    if(this.APIRequests > 0) 
    {
      return false;
    }
    this.APIRequests = 1;
    this.UpdateUIButton(Controllers.activeController===this, 1.0);
        
    this.status.trygoonline = true;
    for(var j=0;j<16;j++)
    {
      if((mask & (1 << j)) > 0) this.APIRequests++;
    }
    this.APIRequests--;
    
    if((mask & GET_RELAY) > 0)
    {
      API.GetData(this.ip, this.apikey, "relay/0", (a)=>{
        this.GotGetAnswer(a, "relay/0", mask);
      });
    }
    
    if((mask & GET_TRANS) > 0)
    {
      API.GetData(this.ip, this.apikey, "transition", (a)=>{
        this.GotGetAnswer(a, "transition", mask);
      });
    }
    
    if((mask & GET_BRIGHT) > 0)
    {
      API.GetData(this.ip, this.apikey, "brightness", (a)=>{
        this.GotGetAnswer(a, "brightness", mask);
      });
    }
    
    if((mask & GET_SL_BR) > 0)
    {
      API.GetData(this.ip, this.apikey, "sl_bright", (a)=>{
        this.GotGetAnswer(a, "sl_bright", mask);
      });
    }
    
    if((mask & GET_SL_CO) > 0)
    {
      API.GetData(this.ip, this.apikey, "sl_color", (a)=>{
        this.GotGetAnswer(a, "sl_color", mask);
      });
    }
    
    if((mask & GET_SL_DI) > 0)
    {
      API.GetData(this.ip, this.apikey, "sl_dir", (a)=>{
        this.GotGetAnswer(a, "sl_dir", mask);
      });
    }
    
    if((mask & GET_SL_NOR) > 0)
    {
      API.GetData(this.ip, this.apikey, "sl_nor", (a)=>{
        this.GotGetAnswer(a, "sl_nor", mask);
      });
    }
    
    if((mask & GET_SL_GAM) > 0)
    {
      API.GetData(this.ip, this.apikey, "sl_gamma", (a)=>{
        this.GotGetAnswer(a, "sl_gamma", mask);
      });
    }
    
    if((mask & GET_CHS) > 0)
    {
      API.GetData(this.ip, this.apikey, "channels", (a)=>{
        this.GotGetAnswer(a, "channels", mask);
      });
    }
    else if((mask & GET_CH0123) > 0)
    {
      for(let j=0;j<4;j++)
      {
        if(((mask & GET_CH0) << j) > 0)
        {
          API.GetData(this.ip, this.apikey, "channel/" + CHANNELS_ID[j], (a)=>{
            this.GotGetAnswer(a, "channel/" + CHANNELS_ID[j], mask);
          });
        }
      }
    }
    return true;
  }
  
  SetBrightness(newBrightness, test)
  {
    if(newBrightness > MAX_VALUE) newBrightness = MAX_VALUE;
    else if(newBrightness < 0) newBrightness = 0;
    if(newBrightness !== this.maxBrightness)
    {
      this.maxBrightness = newBrightness;
      //this.UpdateChannels(test);
      this.UpdateSlider("bright", this.maxBrightness);
    }
  }
  
  SetDirection(newDirection, test)
  {
    if(newDirection > MAX_VALUE) newDirection = MAX_VALUE;
    else if(newDirection < 0) newDirection = 0;
    if(newDirection !== this.direction)
    {
      this.direction = newDirection;
      //this.UpdateChannels(test);
      this.UpdateSlider("dir", this.direction);
    }
  }
  
  UpdateSlider(sliderName, val)
  {
    if(this.updating > 0)
    {
      if(this.nextRequestTimer !== null)
        clearTimeout(this.nextRequestTimer);
      this.nextRequestTimer = setTimeout(()=> {
        this.UpdateSlider(sliderName, val);
      }, 200);
      return;
    }
    this.updating++;
    if(this.nextRequestTimer !== null) {clearTimeout(this.nextRequestTimer); this.nextRequestTimer = null; };
    this.UpdateUIButton(Controllers.activeController===this, 1.0);
    
    API.SendSlider(this.ip, this.apikey, "sl_" + sliderName, val, (a)=>{
      var json = JSON.parse(a);
      var sliderValue = json["sl_" + sliderName];
      Controllers.UpdateUIController(this);
      this.updating--;
      this.UpdateUIButton(Controllers.activeController===this, 0.0);
    }); 
  }
  
  /*
  UpdateChannels(test)
  {
    if(this.updating > 0)
    {
      if(this.nextRequestTimer !== null)
      {
        clearTimeout(this.nextRequestTimer);
      }
      this.nextRequestTimer = setTimeout(()=> {
        this.UpdateChannels(test);
      }, 200);
      return;
    }
    this.updating++;
    if(this.nextRequestTimer !== null) {clearTimeout(this.nextRequestTimer); this.nextRequestTimer = null; };
    this.status.loadingDiv.style.opacity = 1.0;
        
    var brightness = Controllers.GammaCorrection(this.maxBrightness, MAX_VALUE, this.gamma);
    
    log += "<p>Gamma correction from " + this.maxBrightness + " to " + brightness + "<br>";
    
    var channels = [brightness,brightness,brightness,brightness];
    log += "Update channels:<br>";
    if(this.direction <= MAX_VALUE / 2)
    {
      for(var j=0;j<2;j++)
        channels[TOP_CHANNELS[j]] = channels[TOP_CHANNELS[j]] * (this.direction * 1.0 / parseInt(MAX_VALUE / 2));
    }
    else
    {
      for(var j=0;j<2;j++)
        channels[BOTTOM_CHANNELS[j]] = channels[BOTTOM_CHANNELS[j]] * ((MAX_VALUE - this.direction) * 1.0 / parseInt(MAX_VALUE / 2));
    }
    log += "Directions (" + this.direction + "): " + channels[0] + ", " + channels[1] + ", " + channels[2] + ", " + channels[3] + "<br>";
    
    for(var j=0;j<2;j++)
    {
      channels[WHITE_CHANNELS[j]] *= (Controllers.balance * 1.0 / MAX_VALUE);
      channels[YELLOW_CHANNELS[j]] *= (1 - (Controllers.balance * 1.0 / MAX_VALUE));
    }
    for(var j=0;j<4;j++)
      channels[j] = Math.ceil(channels[j]);
    log += "Balance (" + Controllers.balance + "): " + channels[0] + ", " + channels[1] + ", " + channels[2] + ", " + channels[3] + "</p>";
      
    API.SendChannels(this.ip, this.apikey, channels[0], channels[1], channels[2], channels[3], (a)=>{
      var json = JSON.parse(a);
      var chls = json["channels"];
      if(chls && chls.length >= 12)
      {
        for(var j=0;j<4;j++)
        {
          var hex = chls.substring(j*3, j*3+3);
          var int = parseInt(hex, 16);
          if(isNaN(int)) log += "<p>Unable to parse channel " + j + ", value " + hex + " (" + int + ")</p>";
          else this.channels[j] = int;
        }
      }
      Controllers.UpdateUIController(this);
      this.updating--;
      this.status.loadingDiv.style.opacity = 0.0;
    }); 
  }
  */
 
  GenerateUIButton()
  {
    this.button.div = document.createElement("div");
    this.button.div.className = "buttCtrl";
    this.button.title = document.createElement("span");
    this.button.title.setAttribute("style", "pointer-events:none;");
    this.button.title.appendChild(document.createTextNode(this.name.toUpperCase()));
    this.button.div.appendChild(this.button.title);
    var e1 = document.createElement("b");
    e1.appendChild(document.createTextNode(' \u2699 '));
    e1.className = getEditModeClass();
    e1.setAttribute("style", "position:absolute;top:0px;left:5px;font-size:3.5vh;");
    this.button.div.appendChild(e1);
    var e2 = document.createElement("b");
    e2.appendChild(document.createTextNode(' \u{1F4A1} '));
    e2.className = getEditModeClass();
    e2.setAttribute("style", "position:absolute;top:2px;left:4.5vh;font-size:3.5vh;");
    this.button.div.appendChild(e2);
    this.button.power = document.createElement("b");
    this.button.power.appendChild(document.createElement("b"));
    this.button.power.appendChild(document.createElement("i"));
    this.button.power.className="powerButton";
    this.button.power.setAttribute("style", "height:5vh;position:absolute;right:0px;top:0px;filter:hue-rotate(320deg);");
    this.button.power.style.filter = "hue-rotate(" + 320 + "deg)";
    this.button.div.style.filter = "grayscale(" + "100%" + ")";
    this.button.div.appendChild(this.button.power);
    this.button.loading = document.createElement("b");
    this.button.loading.className = "loader";
    this.button.div.appendChild(this.button.loading);
    this.button.loading.style.opacity = 1.0;

    this.button.div.addEventListener("click", ()=>{
      if(this.status.offline)
      {
        if(this.APIfails >= 10)
        {
          this.APIfails = 0;
          this.GetData(GET_ALL); 
        }
      }
      else
      {
        document.getElementById('slidersdiv').opacity = 0.0;
        var isOff = !this.status.on;
        if(isOff)
        {
          this.button.power.click();
        }
        Controllers.SetController(this);
      }
    });

    this.button.power.addEventListener("click", (e)=>{
      if(this.status.offline)
      {
        return;
      }
      else
      {
        this.PowerOnOff((isOn)=>{
          Controllers.SetController(this);
          Controllers.UpdateUI();
          if(isOn)
          {
            this.GetData(GET_ALL);
          }
        });
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // open connection settings
    e1.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(Controllers.activeController === this) 
      {
        Controllers.activeController = null;
        Controllers.UpdateUIController();
      }
      Params.OpenControllerSettings(this);
    });
    
    // open light settings
    e2.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(Controllers.activeController === this) 
      {
        Controllers.activeController = null;
        Controllers.UpdateUIController();
      }
      if(!this.status.offline)
        Params.OpenControllerConfig(this);
    });
    
    this.UpdateUIButton(false, true);
    
    return this.button.div;
  }
  
  UpdateUIButton(isActive, loading)
  {
    if(isActive)
    {
      this.button.div.style.background="linear-gradient(to bottom, #ffef00, #a08000)";
      this.button.title.style.color="#202000";
    }
    else
    {
      this.button.div.style.background="";
      this.button.div.style.color=""; 
    }
    if(parseInt(loading) >= 0)
    {
      this.button.loading.style.opacity = loading;
    }
    
    if(this.status.offline && this.APIfails < 10)
    {
      this.button.loading.style.opacity = 1.0;
    }
    
    this.button.power.style.filter = "hue-rotate(" + (this.status.on?90:320) + "deg)";
    this.button.div.style.filter = "grayscale(" + (this.status.offline?"100%":"0%") + ")";
  }
};

var Controllers = new class
{
  constructor()
  {
    this.controller = [];
    this.count = 0;
    this.color = 50.0;
    this.activeController = null;
    this.balance = MAX_VALUE / 2;
    this.sliders = [];
    this.tableDiv = null;
    this.overlay = null;
  }
  
  CreateSliderUI()
  {
    var div = document.getElementById('slidersdiv');
    div.innerHTML = "";
    this.sliders.push({value:MAX_VALUE / 2, func:(v,t)=>{}, cursor:null});
    this.sliders.push({value:MAX_VALUE / 2, func:(v,t)=>{}, cursor:null});
    this.sliders.push({value:MAX_VALUE / 2, func:(v,t)=>{}, cursor:null});
    div.appendChild(this.AddSlider(
            0, 
            "Brightness", "#FFFFFF", "#A0A0A0", "#000000"
    ));
    div.appendChild(this.AddSlider(
            1, 
            "Temperature", "#B0B0FF", "#FFFFFF", "#FFDD00"
    ));
    div.appendChild(this.AddSlider(
            2, 
            "Direction", "#FFFFFF", "#303030", "#FFFFFF"
    ));
    
    this.tableDiv = document.createElement("table");
    this.tableDiv.className = getExpertModeClass();
    this.tableDiv.setAttribute("style", "font-size:80%;margin:0 auto;width:90vw;opacity:0.5;color:#cdcdcd;");
    var td;
    var tr = document.createElement("tr");
    td = document.createElement("th"); td.appendChild(document.createTextNode("relay")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("trans.")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("gamma")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("bright.")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("norm.")); tr.appendChild(td);
    this.tableDiv.appendChild(tr);
    tr = document.createElement("tr");
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    this.tableDiv.appendChild(tr);
    div.appendChild(this.tableDiv);
    div.style.opacity = 0.0;
    
    this.overlay = document.createElement("div");
    this.overlay.setAttribute("style", "width:100vw;height:100vh;position:absolute;left:0px;top:0px;opacity:0.8;background-color:black;pointer-events:auto;transition:opacity 0.2s ease-in-out;");
    div.appendChild(this.overlay);
  }
  
  GetCount()
  {
    return this.count;
  }
  
  GetController(id)
  {
    for(var j in this.controller)
    {
      if(this.controller[j].id === id)
      {
        return this.controller[j];
      }
    }
    return null;
  }
  
  AddController(id)
  {
    if(typeof id === 'undefined')
      id = (new Date()).getTime();
    
    var ctrl = new Controller(id);
    this.controller.push(ctrl);
    this.count++; 
    return ctrl;
  }
  
  RemoveController(id)
  {
    this.count--;
    this.controller = this.controller.filter(function(c) {return c.id !== id;});
  }
  
  /*
  GammaCorrection(value, maxOut, gamma)
  {
    return parseInt(Math.pow(value * 1.0 / MAX_VALUE, gamma) * maxOut + 0.5);
  }
  */
  /*
  CalcReverseCorrection(chs, maxOut, gamma)
  {
    var s = chs[0] + "," + chs[1] + "," + chs[2] + "," + chs[3] + "<br>";
    var values = {brightness:0,direction:0,balance:this.balance};
    
    var b = Math.max(chs[BOTTOM_CHANNELS[0]], chs[BOTTOM_CHANNELS[1]]);
    var t = Math.max(chs[TOP_CHANNELS[0]], chs[TOP_CHANNELS[1]]);
        
    var maxValue = Math.max(b, t);
    s+= "max Val: " + maxValue + "<br>";
    if(t > b)
    {
      values.direction = MAX_VALUE * (1 - (b / t) * 0.5);
      values.balance = Controllers.balance;
    }
    else if(b===0)
    {
      values.direction = MAX_VALUE / 2;
      values.balance = Controllers.balance;
    }
    else
    {
      values.direction = MAX_VALUE * (t / b) * 0.5;
      values.balance = Controllers.balance;
    }
    if(values.balance >= MAX_VALUE / 2)
      maxValue *= 1.0 / (values.balance * 1.0 / MAX_VALUE);
    else
      maxValue *= 1.0 / (1.0 - values.balance * 1.0 / MAX_VALUE);
    s+= "max Val: " + parseInt(maxValue) + " - gamma: " + gamma + "<br>";
    
    values.brightness = Math.pow(maxValue/maxOut, 1 / gamma) * MAX_VALUE;
    
    s += "<br>bottom: " + b + " top: " +  t + " max: " + maxOut;
    values.brightness = Math.ceil(Math.max(0, values.brightness));
    values.balance = Math.ceil(values.balance);
    values.direction = Math.ceil(values.direction);
    log += "<p>" + s + "<br>" + parseInt(chs[0]) + "," + parseInt(chs[1]) + "," + parseInt(chs[2]) + "," + parseInt(chs[3]) + "<br>Brightness: " + values.brightness + " - Balance: " + values.balance + " - Direction: " + values.direction + "</p>";
    return values;
  }
  */
  PowerOnOff(id, func)
  {
    if(typeof id !== 'undefined')
    {
      this.GetController(id).PowerOnOff(func);
    }
    else
    {
      func(false);
    }
  }
  
  GetData()
  {
    for(var j in this.controller)
    {
      this.controller[j].GetData(GET_ALL);
    }
  }
  
  SetBalance(newBalance, test, force)
  {      
    if(newBalance > MAX_VALUE) newBalance = MAX_VALUE;
    else if(newBalance < 0) newBalance = 0;
    if(newBalance !== this.balance || force)
    {
      if(typeof Params !== 'undefined')
      {
        Params.UpdateBalance(newBalance);
      }
      this.balance = newBalance;
      if(test)
      {
        if(this.activeController !== null)
          this.activeController.UpdateSlider("color", this.balance);
      }
      else
      {
        // update balance of all lights:
        for(var j in this.controller)
        {
          //var success = this.controller[j].UpdateChannels(false);
          this.controller[j].UpdateSlider("color", this.balance);
        }
      }
    }
    else if(typeof force !== 'undefined' && force && this.activeController !== null)
    {
      //this.activeController.UpdateChannels(false);
      this.activeController.UpdateSlider("color", this.balance);
    }
  }
  
  SetController(ctrl)
  {
    Controllers.activeController = ctrl;
    for(var k in this.controller)
    {
      if(ctrl === this.controller[k]) continue;
      this.controller[k].UpdateUIButton(false);
    }
    ctrl.UpdateUIButton(true);
    
    if(!ctrl.status.offline) 
    {
      this.UpdateUIController(ctrl);
    }
    if(ctrl.status.on)
    {
      if(this.overlay.style.opacity > 0.1)
        setTimeout(()=>{this.overlay.style.display="none";}, 200);
      this.overlay.style.opacity = 0.0;
    }
    else
    {
      this.overlay.style.display="block";
      this.overlay.style.opacity = 0.6;
    }
  }
  
  _CreateUI(div)
  {
    div.innerHTML = "";
    for(let j in this.controller)
    {
      var butt = this.controller[j].GenerateUIButton();
      div.appendChild(butt);
    }
  }
  
  UpdateUI()
  {
    var div = document.getElementById('lightsdiv');
    if(div.childNodes.length !== this.controller.length)
    {
      this._CreateUI(div);
    }
    
    if(this.tableDiv === null)
    {
      this.CreateSliderUI();
    }
    
    if(this.activeController !== null && this.activeController.status.on && !this.activeController.status.offline) 
    {
      this.UpdateUIController(this.activeController);
    }
  }
  
  UpdateUIController(controller)
  {
    var div = document.getElementById('slidersdiv');
    div.style.opacity = 1.0;
    if(controller !== this.activeController) 
    {
      return;
    }
    
    this.sliders[0].value = this.activeController.maxBrightness;
    this.sliders[0].func = (v, t)=>{this.activeController.SetBrightness(v, t);};
      
    this.sliders[1].value = this.balance;
    this.sliders[1].func = (v, t)=>{this.SetBalance(v, t, false);};
      
    this.sliders[2].value = this.activeController.direction;
    this.sliders[2].func = (v, t)=>{this.activeController.SetDirection(v, t);};
    
    var tds = this.tableDiv.getElementsByTagName("tr")[1].getElementsByTagName("td");
    tds[0].innerHTML = this.activeController.GetStatus().on ? "ON" : "OFF";       // relay
    tds[1].innerHTML = this.activeController.GetTransition() + " ms";        // transition
    tds[2].innerHTML = parseInt(this.activeController.gamma * 100) / 100.0;  // gamma
    tds[3].innerHTML = parseInt(this.activeController.brightness);           // brightness
    tds[4].innerHTML = this.activeController.normalize ? "ON" : "OFF";       // normalize
    
    var is = div.getElementsByTagName("i");
    
    var maxSlider = window.innerWidth * (0.90 - 0.02);
    var maxPx = maxSlider * 0.98;
    
    for(var j=0;j<3;j++)
    {
      this.sliders[j].cursor.style.left = parseInt(maxPx * this.sliders[j].value / MAX_VALUE + maxSlider * 0.023) + "px";
      is[0 + j*1].innerHTML = parseInt(this.sliders[j].value);
    }
  }
  
  AddSlider(sliderId, title, c1, c2, c3)
  {
    var div = document.createElement("div");
    div.className = "slider";
    var maxSlider = window.innerWidth * (0.90 - 0.02);
    var maxPx = maxSlider * 0.98;
    var lastXPosition = this.sliders[sliderId].value;
    var changeInterval = null;
    
    var i1 = document.createElement("i");
    i1.className = getExpertModeClass();
    i1.setAttribute("style", "position:absolute;top:0px;right:2vw;font-size:50%;color:white;opacity:0.5;");
    i1.appendChild(document.createTextNode(lastXPosition));
    div.appendChild(i1);
    
    var b = document.createElement("b");
    b.appendChild(document.createTextNode(title));
    div.appendChild(b);
    
    var bar = document.createElement("div");
    bar.style.background = "linear-gradient(270deg, " + c1 + ", " + c2 + ", " + c3 + ")";
    div.appendChild(bar);
    
    this.sliders[sliderId].cursor = document.createElement("span");
    this.sliders[sliderId].cursor.style.left = parseInt(maxPx * 0.5 / MAX_VALUE + maxSlider * 0.023) + "px";
    div.appendChild(this.sliders[sliderId].cursor);
    
    var canStep = false;
        
    var fValueChanged = (e, update)=>{
      e.stopPropagation();
      
      if(update) 
      {
        clearInterval(changeInterval); 
        changeInterval = null;
      }
      else if(changeInterval === null) 
      {
        changeInterval = setInterval(()=>{
          var value = MAX_VALUE * (lastXPosition / (maxSlider * 0.98));
          this.sliders[sliderId].func(value, true);
        }, 300);
      }
      
      if(typeof e.buttons !== 'undefined')
      {
        if(e.buttons===0 && !update) return;
        lastXPosition = e.layerX;
      }
      else if(typeof e.touches[0] !== 'undefined')
      {
        if(e.touches.length === 2)
        {
          canStep = true;
          /*
          log += "<br>TOUCHES: " + e.touches.length + " x:" + e.type;
          if(e.touches[0].clientX < window.innerWidth * 0.5)
            lastXPosition = Math.max(0, lastXPosition - maxSlider/4095.0);
          else
            lastXPosition = Math.min(MAX_VALUE, lastXPosition + maxSlider/4095.0);
          if(e.type === 'touchstart')
            update = true;*/
        }
        else if(canStep)
        {
          return;
        }
        else
        {
          lastXPosition = e.touches[0].clientX - window.innerWidth * 0.04;
        }
      }
      else
      {
        canStep = false;
      }
      if(lastXPosition > maxSlider) lastXPosition = maxSlider;
      else if(lastXPosition < maxSlider * 0.02) lastXPosition = maxSlider * 0.02;
      var value = parseInt(MAX_VALUE * ((lastXPosition - maxSlider * 0.02) / (maxSlider * 0.98)));
      i1.innerHTML = value;
      if(update)
      {
        lastXPosition = (lastXPosition - maxSlider * 0.02);
        this.sliders[sliderId].func(value, false);
        e.preventDefault();
      }
      else
      {
        this.sliders[sliderId].cursor.style.left = lastXPosition + "px";
      }
    };
    
    div.addEventListener("mousemove", (e)=>{fValueChanged(e, false);} );
    div.addEventListener("touchmove", (e)=>{fValueChanged(e, false);} );
    div.addEventListener("touchstart", (e)=>{fValueChanged(e, false);} );
    div.addEventListener("touchend", (e)=>{fValueChanged(e, true);} );
    div.addEventListener("mouseup", (e)=>{fValueChanged(e, true);} );
    return div;
  }
};