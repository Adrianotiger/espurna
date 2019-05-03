
var Params = new class
{  
  constructor()
  {
    var ctrls = this.GetCookie("ctrls");
    if(ctrls.length>5)
    {
      ctrls = ctrls.split(",");
      if(!isNaN(ctrls[0]))
      {
        for(var j=0;j<ctrls[0];j++)
        {
          var c = Controllers.AddController(ctrls[j+1]);
          this.GetControllerParams(c); 
        }
      }
    }
    
    var balance = this.GetCookie("balance");
    if(isNaN(balance) || balance.length < 1 || parseInt(balance)>4095) 
    {
      balance = 2047;
      this.SetCookie("balance", balance);
    }
    Controllers.SetBalance(balance, true, true);
    
    this.buttons = parseInt(this.GetCookie("totbutt"));
    if(isNaN(this.buttons)) this.buttons = 0;
    
    this.dialog = null;
    this.overlay = null;
  }
  
  AddSettingParam(dlg, title, value, type, val1, val2)
  {
    var span1 = document.createElement("span");
    span1.appendChild(document.createTextNode(title));
    
    var inp1 = document.createElement("input");
    inp1.setAttribute("style", "text-align:center");
    if(type === "range")
    {
      inp1.setAttribute("min", val1);
      inp1.setAttribute("max", val2);
      if(val2 - val1 < 5) inp1.setAttribute("step", 0.1);
      inp1.addEventListener("change", ()=>{span1.innerHTML = title + " " + inp1.value;});
      span1.appendChild(document.createTextNode(value));
    }
    if(type === "checkbox")
    {
      if(value === true) inp1.setAttribute("checked", true);
    }
    inp1.setAttribute("type", type);
    inp1.setAttribute("value", value);
    
    dlg.appendChild(span1);
    dlg.appendChild(inp1);
    return inp1;
  }
  
  AddController()
  {
    switchEditMode();
    
    Controllers.AddController();
    var s = Controllers.GetCount() + ",";
    for(var c in Controllers.controller)
    {
      s += Controllers.controller[c].id + ",";
    }
    this.SetCookie("ctrls", s);
    for(var j in Controllers.controller)
    {
      this.SaveControllerParams(Controllers.controller[j]);
    }
    setTimeout(()=>{document.location.reload();}, 300);
  }
  
  OpenControllerSettings(ctrl)
  {
    if(this.dialog !== null) 
    {
      document.body.removeChild(this.dialog);
      document.body.removeChild(this.overlay);
    }
    this.dialog = document.createElement("div");
    this.dialog.className = "dialog";
    this.overlay = document.createElement("div");
    this.overlay.className = "dialogoverlay";
        
    var inpD = document.createElement("input");
    inpD.setAttribute("type", "button");
    inpD.setAttribute("value", "Remove '" + ctrl.name + "'");
    inpD.addEventListener("click", ()=>{
      if(confirm("Do you really want remove this light?"))
      {
        Controllers.RemoveController(ctrl.id);
        var s = Controllers.GetCount() + ",";
        for(var c in Controllers.controller)
        {
          s += Controllers.controller[c].id + ",";
        }
        this.SetCookie("ctrls", s);
        document.body.removeChild(this.dialog);
        setTimeout(()=>{document.location.reload();}, 300);
      }      
    });
    this.dialog.appendChild(inpD);
    let inp1 = this.AddSettingParam(this.dialog, "Name: ", ctrl.name, "text");
    inp1.addEventListener("change", ()=>{ctrl.name = inp1.value;});
    let inp2 = this.AddSettingParam(this.dialog, "IP: ", ctrl.ip, "url");
    inp2.addEventListener("change", ()=>{ctrl.ip = inp2.value;});
    let inp3 = this.AddSettingParam(this.dialog, "Api Key: ", ctrl.apikey, "text");
    inp3.addEventListener("change", ()=>{ctrl.apikey = inp3.value;});
    
    var inpS = document.createElement("input");
    inpS.setAttribute("type", "button");
    inpS.setAttribute("value", "Save");
    inpS.setAttribute("style", "margin-top:2vh;");
    inpS.addEventListener("click", ()=>{
      for(var j in Controllers.controller)
      {
        this.SaveControllerParams(Controllers.controller[j]);
      }
      document.body.removeChild(this.overlay);
      this.dialog = null;
      Controllers.UpdateUI();
    });
    this.dialog.appendChild(inpS);
    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);
    
    this.dialog.addEventListener("click", (e)=>{
      e.stopPropagation();
    });
    this.dialog.addEventListener("contextmenu", (e)=>{
      e.stopPropagation();
      return true;
    });
    this.overlay.addEventListener("click", ()=>{
      this.dialog.style.transform = "translate(-50%, 200%)";
      this.overlay.style.opacity = "0.0";
      setTimeout(()=>{
        document.body.removeChild(this.overlay);
        this.dialog = null;
      }, 1000);
    });
    setTimeout(()=> {this.dialog.style.transform = "translate(-50%, -50%)";}, 100);
  }
  
  OpenControllerConfig(ctrl)
  {
    if(this.dialog !== null) 
    {
      document.body.removeChild(this.dialog);
      document.body.removeChild(this.overlay);
    }
    this.dialog = document.createElement("div");
    this.dialog.className = "dialog";
    this.overlay = document.createElement("div");
    this.overlay.className = "dialogoverlay";
    
    let inp4 = this.AddSettingParam(this.dialog, "Gamma corr.: ", ctrl.gamma, "range", "0.5", "2.5");
    
    let inp5 = this.AddSettingParam(this.dialog, "Normalize color: ", ctrl.normalize, "checkbox");
    
    let inp6 = this.AddSettingParam(this.dialog, "Invert PWM: ", ctrl.invertPWM, "checkbox");
    
    var inpS = document.createElement("input");
    inpS.setAttribute("type", "button");
    inpS.setAttribute("value", "Save");
    inpS.setAttribute("style", "margin-top:2vh;");
    inpS.addEventListener("click", ()=>{
      API.SendSlider(ctrl.ip, ctrl.apikey, "sl_gamma", parseInt(inp4.value * 100.0), (a)=>{
        var json = JSON.parse(a);
        var sliderValue = json["sl_gamma"];
        ctrl.gamma = sliderValue / 100.0;
      }); 
      
      API.SendSlider(ctrl.ip, ctrl.apikey, "sl_nor", (inp5.checked) ? 1 : 0, (a)=>{
        var json = JSON.parse(a);
        var sliderValue = json["sl_nor"];
        ctrl.normalize = sliderValue > 0;
      }); 
      
      API.SendSlider(ctrl.ip, ctrl.apikey, "sl_invpwm", (inp6.checked) ? 1 : 0, (a)=>{
        var json = JSON.parse(a);
        var sliderValue = json["sl_invpwm"];
        ctrl.invertPWM = sliderValue > 0;
      });
      
      document.body.removeChild(this.overlay);
      this.dialog = null;
    });
    this.dialog.appendChild(inpS);
    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);
    
    this.dialog.addEventListener("click", (e)=>{
      e.stopPropagation();
    });
    this.dialog.addEventListener("contextmenu", (e)=>{
      e.stopPropagation();
      return true;
    });
    this.overlay.addEventListener("click", ()=>{
      this.dialog.style.transform = "translate(-50%, 200%)";
      this.overlay.style.opacity = "0.0";
      setTimeout(()=>{
        document.body.removeChild(this.overlay);
        this.dialog = null;
      }, 1000);
    });
    setTimeout(()=> {this.dialog.style.transform = "translate(-50%, -50%)";}, 100);
  }
  
  SaveControllerParams(ctrl)
  {
    this.SetCookie("ctrl" + ctrl.id + "_name", ctrl.name);
    this.SetCookie("ctrl" + ctrl.id + "_ip", ctrl.ip);
    this.SetCookie("ctrl" + ctrl.id + "_apikey", ctrl.apikey);
    this.SetCookie("ctrl" + ctrl.id + "_gamma", ctrl.gamma);
  }
  
  GetControllerParams(ctrl)
  {
    ctrl.name = this.GetCookie("ctrl" + ctrl.id + "_name");
    ctrl.ip = this.GetCookie("ctrl" + ctrl.id + "_ip");
    ctrl.apikey = this.GetCookie("ctrl" + ctrl.id + "_apikey");
    ctrl.gamma = this.GetCookie("ctrl" + ctrl.id + "_gamma");
    if(isNaN(parseFloat(ctrl.gamma)) || parseFloat(ctrl.gamma) < 0.2) ctrl.gamma = 1.0;
  }
  
  UpdateBalance(balance)
  {
    if(Controllers.balance !== balance)
    {
      Controllers.balance = balance;
      this.SetCookie("balance", balance);
    }
  }
    
  GetCookie(cname) 
  {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) 
    {
      var c = ca[i];
      while (c.charAt(0) === ' ') 
      {
        c = c.substring(1);
      }
      if (c.indexOf(name) === 0) 
      {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  } 
  
  SetCookie(cname, cvalue)
  {
    var exdays = 365 * 25; // 25 years
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
  }
};
