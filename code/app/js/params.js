
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
    
    Controllers.balance = this.GetCookie("balance");
    if(isNaN(Controllers.balance) || Controllers.balance.length < 1 || parseInt(Controllers.balance)>4095) 
    {
      Controllers.balance = 2047;
      this.SetCookie("balance", Controllers.balance);
    }
    
    this.buttons = parseInt(this.GetCookie("totbutt"));
    if(isNaN(this.buttons)) this.buttons = 0;
    
    this.dialog = null;
  }
  
  AddSettingParam(dlg, title, value)
  {
    var span1 = document.createElement("span");
    span1.appendChild(document.createTextNode(title));
    
    var inp1 = document.createElement("input");
    inp1.setAttribute("style", "text-align:center");
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
    if(this.dialog !== null) document.body.removeChild(this.dialog);
    this.dialog = document.createElement("div");
    this.dialog.className = "dialog";
    
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
    let inp1 = this.AddSettingParam(this.dialog, "Name: ", ctrl.name);
    inp1.addEventListener("change", ()=>{ctrl.name = inp1.value;});
    let inp2 = this.AddSettingParam(this.dialog, "IP: ", ctrl.ip);
    inp2.addEventListener("change", ()=>{ctrl.ip = inp2.value;});
    let inp3 = this.AddSettingParam(this.dialog, "Api Key: ", ctrl.apikey);
    inp3.addEventListener("change", ()=>{ctrl.apikey = inp3.value;});
    inp3.addEventListener("contextmenu", (e)=>{
      document.execCommand('copy');
      alert("Text was copied");
    });
    var inpS = document.createElement("input");
    inpS.setAttribute("type", "button");
    inpS.setAttribute("value", "Save");
    inpS.setAttribute("style", "margin-top:2vh;");
    inpS.addEventListener("click", ()=>{
      for(var j in Controllers.controller)
      {
        this.SaveControllerParams(Controllers.controller[j]);
      }
      document.body.removeChild(this.dialog);
      this.dialog = null;
      Controllers.UpdateUI();
    });
    this.dialog.appendChild(inpS);
    document.body.appendChild(this.dialog);
  }
  
  SaveControllerParams(ctrl)
  {
    this.SetCookie("ctrl" + ctrl.id + "_name", ctrl.name);
    this.SetCookie("ctrl" + ctrl.id + "_ip", ctrl.ip);
    this.SetCookie("ctrl" + ctrl.id + "_apikey", ctrl.apikey);
  }
  
  GetControllerParams(ctrl)
  {
    ctrl.name = this.GetCookie("ctrl" + ctrl.id + "_name");
    ctrl.ip = this.GetCookie("ctrl" + ctrl.id + "_ip");
    ctrl.apikey = this.GetCookie("ctrl" + ctrl.id + "_apikey");
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
