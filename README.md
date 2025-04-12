# JSON Client Template

**Client Template for server-side Google Tag Manager**

The JSON Client receives JSON Payloads and makes the data available in the Event Data. The built-in ID Service creates long lasting server-side set (HTTP-Only) cookies for visitor identification.

## Usage and Configuration Options
1. Download the template.tpl from this GitHub Repository
2. Go to the Templates Section in your server-side GTM Instance
3. In the Client Templates Section click on "New"
4. Select "Import" in the three dots menu at the top right
5. Select the Downloaded template.tpl file and save the Template
6. Close the Template Editor and go to the Clients Section
7. Create a new Client and select the "JSON Client" as client type
8. Configure the JSON Client according to your needs and save it

### Request Path
Please define the Path under which you want the Endpoint to be available. This path needs to match the path which is configured in the JSON Tag Variable in the client-side GTM (See: https://github.com/floriangoetting/json-tag-variable?tab=readme-ov-file#endpoint-path).

### Set Device ID Cookie
If this option is enabled, a UUID v4 will be generated and will set a server-side Cookie with the configured settings. This can be used to reidentify the device of a visitor.

### Device ID Cookie Name
In this field you can specify the name of your server-side Device ID cookie.

### Device ID Cookie Lifetime (Days)
You can customize the number of days here how long you want the Device ID Cookie to live. The default value 400 is the maximum number of days for a cookie to live which is supported by Google Chrome.

### Set Session ID Cookie
If this option is enabled, a unix timestamp in milliseconds will be generated and will set a server-side Cookie with the configured settings. This can be used to identify the session of a visitor.

### Session ID Cookie Name
In this field you can specify the name of your server-side Session ID cookie.

### Session ID Cookie Lifetime (Minutes)
You can customize the number of minutes here how long you want the Session ID Cookie to live. With the default value of 30 minutes, the Session ID Cookie will be deleted and recreated if the visitor comes back to the site after 30 minutes of inactivity. If the visitor continues to browse through the site, the Session Cookie lifetime will be reset to the number of minutes again to retain the session.

### Cookie Domain
The Domain on which you want to set your server-side Cookies. Usually this will be .yourdomain.com to include subdomains as well. If you leave the default value "auto" it will be automatically detected as the eTLD+1 of the first header found in the following priority order: 1. 'Forwarded', 2. 'X-Forwarded-Host', 3. 'Host'.

### Cookie Path
You can specify a path here if you want the cookies only be sent on specific URL Paths. Normally this should be left with the default "/".

### Set Secure Flag
With the secure flag enabled you make sure, that the cookies will only be set if the HTTPS protocol is beeing used.

### Set HttpOnly Flag
With the HttpOnly Flag enabled, you make sure, that the cookies can not be read by javascript for example using document.cookie. If you need to read the cookie values in the client-side GTM, you can still read them from the Data Layer.

### SameSite Attribute
This attribute defines whether the cookies are sent with cross-site requests.

### Enable CORS Headers
If your Tagging Server is served from a different domain or subdomain, you will need to configure the CORS Headers to make sure that the requests are not blocked. Please note that the CORS Headers will not work until you publish the ssGTM Container the first time with the setting enabled. You will also need to clear the browser cache and cookies after you published the ssGTM Container.

### Allowed Origins
Please enter a valid RegEx here to validate the origin. If the RegEx is not matched, the request will not be claimed. If you do not want to validate the origin, just leave the default value of "*".

### Enable Failure Event
When this option is activated, the JSON Client will listen for failed tags and will create a failure event when at least one of the tags failed. You can send additional data like the request and response from the tags to the JSON Client which will be included in the event. For more details about this please check the section "How to get a more detailed Failure Event".

### Failure Event Name
You can customize the name of the failure event here. The default event name is "tag_failure".

## How to get a more detailed Failure Event
If you enable the Failure Event, the first step you should do afterwards is to enable the Additional Tag Metadata in your Server Tags. This will enable you to identify the actual tag which failed. To do this, go to each Server Tag Configuration and search for the section "Additional Tag Metadata". Activate the option "Include tag name" and just enter "name" in the "Key for tag name". Now you will see the Name of the tag in the Failure Event in case the tag failed.

For a more detailed Failure Event, you can also send any information from the Server Tag to JSON Client in case a failure has been detected. You can use this for example to send the response from the Server Tag to JSON Client in case of a failure and you will have much more actionable insights to provide a fix. If you want to use this feature, you would need to update the Template Code of the Server Tag where you want to send data from. Please note that when updating a Tag Template, you won't receive automatic updates of the Tag Template anymore from the Template Gallery. If you want to proceed with this anyway, you need to follow these steps:
1. Open the Code Editor of the Tag Template which you want to modify.
2. Require the send Message library with this line of code:

   ```javascript
   const sendMessage = require('sendMessage');
   ```
3. Use the sendMessage Api with the message Type 'server_monitor' and as message set an object with an attribute 'service' with an identifier of the tag and set any additional attributes which you want to measure in the Failure Event.
Example:

   ```javascript
   sendMessage('server_monitor', {
      'service': 'amplitude',
      'request': postBody,
      'response': JSON.parse(responseBody)
    });
   ````
4. Update the Uses messages permission and set it to "Any".
5. If you now produce a tag failure by for example using some invalid field values, you should see the Tag Failure Event firing in the ssGTM Preview Mode. An object called "monitor" will contain the information of the failed tags and your custom data sent via sendMessage. You can track the data with the tool of your choice.

## Sending Data from Server Tags in the JSON Client Response
JSON Client is capable to receive message data from Server Tags and sends the data in the response. The JSON Tag is then including this data in the Data Layer Push as well which makes it available to be used in the client-side Google Tag Manager.

If you want to use this feature, you would need to update the Template Code of the Server Tag where you want to send data from. Please note that when updating a Tag Template, you won't receive automatic updates of the Tag Template anymore from the Template Gallery.

If you want to proceed with this anyway, you need to follow these steps:
1. Open the Code Editor of the Tag Template which you want to modify.
2. Require the send Message library with this line of code:

   ```javascript
   const sendMessage = require('sendMessage');
   ```
3. Use the sendMessage Api with the message Type 'send_response' and as message, set an object with a parent key which should be the Name of the Tag. In this Example, it is an Amplitude Tag so the parent key is set to "amplitude".
Example:

   ```javascript
    //return response to JSON Client
    sendMessage('send_response', {
      amplitude: {
        api_key: apiKey
      }
    });
   ```
4. Update the Uses messages permission and set it to "Any".
5. Save the Template and test if it works as expected.

## Support for Native Apps and App Webviews
There is no native SDK or direct support for the mobile client-side GTM for JSON Tags. However, it is possible to generate JSON payloads in a native app and send the data to the JSON Client endpoint in server-side GTM.

### Handling of Origin Headers
It is not an issue that requests from native apps do not contain an Origin header. If the JSON Client does not find an Origin in the request, the validation will automatically pass without any checks.

### Managing Device and Session IDs in Native Apps
Since native apps do not support cookies, a custom mechanism must be implemented to persist the device and session ID. If these IDs are already set natively, they should be included in the request headers as cookies, using the same names configured in the JSON Client. The JSON Client will then use these IDs instead of generating new ones.

### Support for App Webviews
The behavior in app webviews is similar:
When a native app opens a webview, the device and session cookies must be injected into the webview using the same cookie names configured in the JSON Client. This ensures that the JSON Client recognizes and uses the existing IDs instead of creating new ones.
