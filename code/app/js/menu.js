/* global log */
var editMode = false;
var expertMode = false;
var logTimer = null;

function switchEditMode(el)
{
  var newMode = editMode ? "edit_no" : "edit_yes";
  var items = document.getElementsByClassName(getEditModeClass());
  while(items.length>0)
  {
    items[0].className = newMode;
  }
  editMode = !editMode;
  if(typeof el !== 'undefined')
    el.style.color = editMode ? "white" : "";
}

function getEditModeClass()
{
  return editMode ? "edit_yes" : "edit_no";
}

function switchExpertMode(el)
{
  var newMode = expertMode ? "expert_no" : "expert_yes";
  var items = document.getElementsByClassName(getExpertModeClass());
  while(items.length>0)
  {
    items[0].className = newMode;
  }
  expertMode = !expertMode;
  el.style.color = expertMode ? "white" : "";
}

function getExpertModeClass()
{
  return expertMode ? "expert_yes" : "expert_no";
}

function showLog(el)
{
  var dd = document.getElementById("debugdiv");
  var h = parseInt(dd.style.height);
  if(isNaN(h)) h = 2;
  dd.innerHTML = log;
  dd.scrollTop = document.getElementById("debugdiv").scrollHeight;
  dd.style.height = h < 10 ? "80vh" : "2vh";
  dd.style.opacity = h < 10 ? "0.9" : "0.1";
  el.style.color = h < 10 ? "white" : "";
  if(h < 10)
  {
    logTimer = setInterval(()=>{
      var log2 = dd.innerHTML.length;
      if(log2 < log.length)
      {
        dd.innerHTML = log;
        dd.scrollTop = document.getElementById("debugdiv").scrollHeight;
      }
    }, 300);
  }
  else
  {
    clearInterval(logTimer);
    logTimer = null;
  }
}
