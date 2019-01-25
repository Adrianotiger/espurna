/* global API, log */
const MAX_VALUE = 4095;
const GET_RELAY  = 0x001;
const GET_TRANS  = 0x002;
const GET_BRIGHT = 0x004;
const GET_CHS    = 0x400;
const GET_CH0    = 0x010;
const GET_CH1    = 0x020;
const GET_CH2    = 0x040;
const GET_CH3    = 0x080;
const GET_CH0123 = 0x0F0;
const GET_ALL    = GET_RELAY | GET_TRANS | GET_BRIGHT | GET_CHS;

const YELLOW_CHANNELS = [0,3];
const WHITE_CHANNELS = [1,2];
const TOP_CHANNELS = [2,3];
const BOTTOM_CHANNELS = [0,1];
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
    this.transition = 0;
    this.updating = 0;
    this.channels = [-1,-1,-1,-1];
    this.maxBrightness = MAX_VALUE / 2;
    this.APIfails = 0;
    this.APIRequests = 0;
    this.nextRequestTimer = null;
    this.gamma = 1.0;
    this.status = { on:false, offline:true, trygoonline:false, loadingDiv:null };
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
    this.status.loadingDiv.style.opacity = 1.0;
    API.SendOnOff(this.ip, this.apikey, !this.status.on, (a)=>{
      var j = JSON.parse(a);
      if(j && !isNaN(parseInt(j["relay/0"]))) 
      {
        this.status.on = parseInt(j["relay/0"]);
        func(this.status.on);
      }
      this.status.loadingDiv.style.opacity = 0.0;
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
        log += "<p style='color:darkred'>" + j['error'] + "-" + this.ip + "</p>";
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
          case "transition" : this.transition = parseInt(j[param]); break;
          case "channels"   : var chls = j[param];
                              if(chls.length >= 12)
                              {
                                for(var j=0;j<4;j++)
                                {
                                  var hex = chls.substring(j*3, j*3+3);
                                  var int = parseInt(hex, 16);
                                  if(isNaN(int)) log += "<p>Unable to parse channel " + j + ", value " + hex + " (" + int + ")</p>";
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
      log += "<p> Can't go online: " + err + "</p>";
      this.status.trygoonline = false;
      this.status.offline = true;
    }
    this.APIRequests--;
    if(this.APIRequests <= 0)
    {
      log += "<i>GOT ALL DATA</i><hr>";
      this.status.loadingDiv.style.opacity = 0;
      
      if(mask === GET_ALL && !this.status.trygoonline && ++this.APIfails < 10)
      {
        setTimeout(()=>{this.GetData(mask);}, 1000 - this.APIfails*50);
      }
      else if(this.status.offline && this.status.trygoonline)
      {
        this.status.offline = false;
        var v = Controllers.CalcReverseCorrection([this.channels[0],this.channels[1],this.channels[2],this.channels[3]], MAX_VALUE, this.gamma);
        this.maxBrightness = v.brightness;
        this.direction = v.direction;
        if(Math.abs(Controllers.balance - v.balance) > 10) // update light balance with current if it drifts too much
        {
          log += "<p style='color:#604000'>WRONG balance, reset from " + v.balance + " to " + Controllers.balance + "</p>";
          Controllers.SetBalance(Controllers.balance, false, true);
          //Controllers.balance = v.balance;
        }
      }
      
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
    this.status.loadingDiv.style.opacity = 1.0;
    
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
      this.UpdateChannels(test);
    }
  }
  
  SetDirection(newDirection, test)
  {
    if(newDirection > MAX_VALUE) newDirection = MAX_VALUE;
    else if(newDirection < 0) newDirection = 0;
    if(newDirection !== this.direction)
    {
      this.direction = newDirection;
      this.UpdateChannels(test);
    }
  }
  
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
      if(chls.length >= 12)
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
      
    /*
    for(let j=0;j<4;j++)
    {
      channels[j] = Controllers.GammaCorrection(channels[j], MAX_VALUE, this.gamma);
      var updated = 0;
      
      API.SendChannel(this.ip, this.apikey, CHANNELS_ID[j], channels[j], (a)=>{
        var json = JSON.parse(a);
        this.channels[j] = parseInt(json["channel/" + CHANNELS_ID[j]]);
        if(++updated >= 4) 
        {
          Controllers.UpdateUIController(this);
          this.updating--;
          this.status.loadingDiv.style.opacity = 0.0;
        }
      }); 
    }
    */
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
    td = document.createElement("th"); td.appendChild(document.createTextNode("trans.")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("gamma")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("bright.")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("CH #1")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("CH #2")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("CH #3")); tr.appendChild(td);
    td = document.createElement("th"); td.appendChild(document.createTextNode("CH #4")); tr.appendChild(td);
    this.tableDiv.appendChild(tr);
    tr = document.createElement("tr");
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    td = document.createElement("td"); td.appendChild(document.createTextNode("-")); tr.appendChild(td);
    this.tableDiv.appendChild(tr);
    div.appendChild(this.tableDiv);
    div.style.opacity = 0.0;
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
  
  GammaCorrection(value, maxOut, gamma)
  {
    return parseInt(Math.pow(value * 1.0 / MAX_VALUE, gamma) * maxOut + 0.5);
  }
  
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
      //maxValue = maxValue * 1 / (1 - (MAX_VALUE / values.balance));
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
      //maxValue = maxValue * 1 / (values.balance / MAX_VALUE);
    }
    s+= "max Val: " + parseInt(maxValue) + " - gamma: " + gamma + "<br>";
    
    values.brightness = Math.pow(maxValue/maxOut, 1 / gamma) * MAX_VALUE;
    
    s += "<br>bottom: " + b + " top: " +  t + " max: " + maxOut;
    values.brightness = Math.ceil(Math.max(0, values.brightness));
    values.balance = Math.ceil(values.balance);
    values.direction = Math.ceil(values.direction);
    log += "<p>" + s + "<br>" + parseInt(chs[0]) + "," + parseInt(chs[1]) + "," + parseInt(chs[2]) + "," + parseInt(chs[3]) + "<br>Brightness: " + values.brightness + " - Balance: " + values.balance + " - Direction: " + values.direction + "</p>";
    return values;
  }
  
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
          this.activeController.UpdateChannels(true);
      }
      else
      {
        // update balance of all lights:
        for(var j in this.controller)
        {
          var success = this.controller[j].UpdateChannels(false);
        }
      }
    }
    else if(typeof force !== 'undefined' && force && this.activeController !== null)
    {
      this.activeController.UpdateChannels(false);
    }
  }
  
  UpdateUI()
  {
    var div = document.getElementById('lightsdiv');
    div.innerHTML = "";
    for(let j in this.controller)
    {
      let ctrl = this.controller[j];
      
      var b = document.createElement("div");
      b.className = "buttCtrl";
      var b2 = document.createElement("span");
      b2.setAttribute("style", "pointer-events:none;");
      b2.appendChild(document.createTextNode(ctrl.name.toUpperCase()));
      b.appendChild(b2);
      var e1 = document.createElement("b");
      e1.appendChild(document.createTextNode(' \u2699 '));
      e1.className = getEditModeClass();
      e1.setAttribute("style", "position:absolute;top:0px;left:5px;font-size:3.5vh;");
      b.appendChild(e1);
      let i1 = document.createElement("b");
      i1.appendChild(document.createElement("b"));
      i1.appendChild(document.createElement("i"));
      i1.className="powerButton";
      i1.setAttribute("style", "height:5vh;position:absolute;right:0px;top:0px;filter:hue-rotate(320deg);");
      i1.style.filter = "hue-rotate(" + (ctrl.GetStatus().on?90:320) + "deg)";
      b.style.filter = "grayscale(" + (ctrl.GetStatus().offline?"100%":"0%") + ")";
      if(this.activeController === ctrl)
      {
        b.style.background="linear-gradient(to bottom, #ffef00, #a08000)";
      }
      b.appendChild(i1);
      ctrl.status.loadingDiv = document.createElement("b");
      ctrl.status.loadingDiv.className = "loader";
      b.appendChild(ctrl.status.loadingDiv);
      if(ctrl.status.offline && ctrl.APIfails < 10)
        ctrl.status.loadingDiv.style.opacity = 1.0;
      div.appendChild(b);
      
      b.addEventListener("click", ()=>{
        if(ctrl.GetStatus().offline)
        {
          if(ctrl.APIfails >= 10)
          {
            ctrl.APIfails = 0;
            ctrl.GetData(GET_ALL); 
          }
        }
        else
        {
          document.getElementById('slidersdiv').opacity = 0.0;
          var isOff = !ctrl.GetStatus().on;
          if(isOff)
          {
            i1.click();
          }
          this.activeController = ctrl;
          for(var k in div.childNodes)
          {
            if(div.childNodes[k].className !== "buttCtrl") continue;
            div.childNodes[k].style.background="";
            div.childNodes[k].style.color="";
          }
          b.style.background="linear-gradient(to bottom, #ffef00, #a08000)";
          b.childNodes[0].style.color="#202000";
          if(!isOff && !ctrl.GetStatus().offline) 
          {
            this.UpdateUIController(this.activeController);
          }
        }
      });
      
      i1.addEventListener("click", (e)=>{
        if(ctrl.GetStatus().offline)
        {
          return;
        }
        else
        {
          this.PowerOnOff(ctrl.id, (isOn)=>{
            if(!isOn)
            {
              this.UpdateUI();
            }
            else
            {
              ctrl.GetData(GET_ALL);
            }
          });
          e.preventDefault();
          e.stopPropagation();
        }
      });
      
      e1.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        if(Controllers.activeController === this) 
        {
          Controllers.activeController = null;
          Controllers.UpdateUIController();
        }
        Params.OpenControllerSettings(ctrl);
      });
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
    tds[0].innerHTML = this.activeController.GetTransition() + " ms";
    tds[1].innerHTML = parseInt(this.activeController.gamma * 100) / 100.0;
    tds[2].innerHTML = parseInt(this.activeController.GetBrightness());
    tds[3].innerHTML = parseInt(this.activeController.GetChannels()[0]);
    tds[4].innerHTML = parseInt(this.activeController.GetChannels()[1]);
    tds[5].innerHTML = parseInt(this.activeController.GetChannels()[2]);
    tds[6].innerHTML = parseInt(this.activeController.GetChannels()[3]);
    
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