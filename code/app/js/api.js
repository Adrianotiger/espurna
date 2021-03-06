
var API = new class
{
  constructor()
  {
    
  }
  
  GetData(ip, apikey, param, callback)
  {
    if(typeof callback !== 'undefined' && (ip.startsWith("0.") || apikey.length<8)) 
    {
      callback('{"error" : "IP or key is not correct"}');
    }
    else
    {
      var link = "http://" + ip + "/api/" + param;
      link += "?apikey=" + apikey;
      this.SendGetRequest(link, callback);
    }
  }
  
  SendOnOff(ip, apikey, on, callback)
  {
    var link = "http://" + ip + "/api/relay/0";
    var params = "apikey=" + apikey + "&value=" + (on?"1":"0");
    this.SendPutRequest(link, params, callback);
  }
  
  SendBrightness(ip, apikey, brightness, callback)
  {
    var link = "http://" + ip + "/api/brightness";
    var params = "apikey=" + apikey + "&value=" + parseInt(brightness);
    this.SendPutRequest(link, params, callback);
  }
  
  SendChannel(ip, apikey, chId, brightness, callback)
  {
    var link = "http://" + ip + "/api/channel/" + chId;
    var params = "apikey=" + apikey + "&value=" + parseInt(brightness);
    this.SendPutRequest(link, params, callback);
  }
  
  SendSlider(ip, apikey, slider, value, callback)
  {
    var link = "http://" + ip + "/api/" + slider;
    var params = "apikey=" + apikey + "&value=" + parseInt(value);
    this.SendPutRequest(link, params, callback);
  }
  
  SendChannels(ip, apikey, ch0, ch1, ch2, ch3, callback)
  {
    var link = "http://" + ip + "/api/channels";
    var param2hex = ("000" + ch0.toString(16)).substr(-3) + ("000" + ch1.toString(16)).substr(-3) + ("000" + ch2.toString(16)).substr(-3) + ("000" + ch3.toString(16)).substr(-3);
    var params = "apikey=" + apikey + "&value=" + param2hex;
    this.SendPutRequest(link, params, callback);
  }
  
  GetJSON(r)
  {
    return r.replace(/:[ ]*(0[0-9a-fA-F]*)/g, ':"$1"');
  }
  
  RequestStateChange(req, callback)
  {
    if (req.readyState === 4) 
    {
      if(req.status === 200)
      {
        var l = "<p>RESPONSE:";
        var json = JSON.parse(this.GetJSON(req.response));
        for(var k in json)
        {
          l += "- " + k + "=" + json[k];
        }
        AddToLog(l + "</p>");
        if(typeof callback !== 'undefined') callback(this.GetJSON(req.response));
      }
    }
  }
  
  RequestStateError(req, callback, err)
  {
    if(typeof callback !== 'undefined') callback('{"error" : "' + (err && err.type && err.type==='timeout'?"Timeout":(req.responseText?req.responseText:err)) + '"}');
    else AddToLog("<p> STATUS ERROR: " + req.status + (err && err.type && err.type==='timeout'?"Timeout":req.responseText) + "</p>");
  }
  
  SendGetRequest(link, callback)
  {
    try
    {
      var req = new XMLHttpRequest();
      req.open("GET", link, true); 
      req.timeout = 1000;
            
      req.onreadystatechange = ()=>{this.RequestStateChange(req, callback);};
      req.onerror = (e)=>{this.RequestStateError(req, callback, e); };
      req.ontimeout = (e)=>{this.RequestStateError(req, callback, e); };
      
      AddToLog("<p>Send (GET)<br>" + link + "</p>");
      
      req.setRequestHeader("Accept", "application/json");
      req.withCredentials = false;
      req.send(null);
    }
    catch(err)
    {
      this.RequestStateError(req, callback, false);
    }
  }
  
  SendPutRequest(link, params, callback)
  {
    try
    {
      var req = new XMLHttpRequest();
      req.open("PUT", link + "?" + params, true);
      req.onreadystatechange = ()=>{
        if (req.readyState === 4) 
        { 
          if(req.status === 200)
          {
            var l = "<p>RESPONSE: '";
            var json = JSON.parse(this.GetJSON(req.responseText));
            for(var k in json)
            {
              l += " - " + k + "'=" + json[k];
            }
            AddToLog(l + "</p>");
            if(typeof callback !== 'undefined') callback(this.GetJSON(req.responseText));
          }
          else
          {
            AddToLog("<p> STATUS ERROR: " + req.status + ", " + req.responseText + "</p>");
            if(typeof callback !== 'undefined') callback('{"error" : "' + req.responseText + '"}');
          }
        }
      };
      
      AddToLog("<p>Send <br>" + link + "<br>" + params + "</p>");
      
      req.setRequestHeader("Accept", "application/json");
      req.withCredentials = false;
      
      req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      req.send(params);
    }
    catch(err)
    {
      alert("ERROR:" + err);
    }
  }
  
  SendRequest(command, paramvalue, method)
  {
    try
    {
      var dd = document.getElementById("debugdiv");
      dd.innerHTML = "v0.0.13";
    
      var params = "apikey=" + Params.apikey;
      params += "&value=" + encodeURIComponent(paramvalue);
      var req = new XMLHttpRequest();
      if(typeof method === 'undefined') method = 'GET2';
      var link = "";
      switch(method)
      {
        case 'PUT':   link = "http://" + Params.ip + "/api/" + command + "?" + params; req.open("PUT", link, true); break;
        case 'POST':  link = "http://" + Params.ip + "/api/" + command + "?" + params; req.open("POST", link, true); break;
        case 'GET':   link = "http://" + Params.ip + "/api/" + command + "?apikey=" + Params.apikey; req.open("GET", link, true); break;
        case 'GET2':  link = "http://" + Params.ip + "/apis?apikey=" + Params.apikey; req.open("GET", link, true); break;
      }
      req.onreadystatechange = function () 
      {
        if (req.readyState === 4) 
        {
          var s = "";
          var h = req.getAllResponseHeaders();
          for(var j in h){s += j + "=" + h[j] + "\n";}
          
          if(req.status === 200)
          {
            dd.innerHTML += "<br>RESPONSE:<br>";
            var json = JSON.parse(req.response);
            for(var k in json)
            {
              dd.innerHTML += k + "=" + json[k] + "<br>";
            }
          }
          else
          {
            dd.innerHTML += "<br> STATUS ERROR: " + req.status + "\n" + req.responseText + "\n" + h;
          }
        }
      };
      
      dd.innerHTML += "<br>Send (" + method + ")<br>" + link + "<br>";
      
      req.setRequestHeader("Accept", "application/json");
      req.withCredentials = false;
      
      switch(method)
      {
        case 'PUT': 
        case 'POST':req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                    req.send(params);
                    break;
                    
        default:    req.send(null);
                    break;
      }
    }
    catch(err)
    {
      alert("ERROR:" + err);
    }
  }
};
