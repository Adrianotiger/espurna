# ESPurna FORK
This is just a fork of the ESPurna project ([open original project](https://github.com/xoseperez/espurna)).

## FOCUS
It was focused on the H801 and Web-API.
Settings are modified, so it compiles on the H801 module and allows Web-Api control over GET and POST.
Added a Web-Interface (Web-App to control the lights).
<b>Controls multiple modules with 4 defined channels over 3 sliders:</b>
- Bottom LEDs: 2 strips: white and yellow
- Top LEDs: 2 strips: white and yellow
- Brightness slider: each module has a brightness
- Balance slider: the color (yellow or white) will change on every module at the same time
- Direction slider: each module can bright more on the upper or lower side

![screenshot](images/app_1.jpg)

## How it works
... coming soon

## Changes over the fork
- To allow CORS, some http-headers was added
- Parameters was changed to work with the H801 module and Web-Api
- Workaround for the ESP8266 flickering problem with PWM on low values


## Known issues
- https does not work (H801 has not enough memory for the entire SSL-encryption library)