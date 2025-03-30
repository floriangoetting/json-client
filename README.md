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

### Set Session ID Cookie
If this option is enabled, a unix timestamp in milliseconds will be generated and will set a server-side Cookie with the configured settings. This can be used to identify the session of a visitor.

### Session ID Cookie Name
In this field you can specify the name of your server-side Session ID cookie.

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
If your Tagging Server is served from a different domain or subdomain, you will need to configure the CORS Headers to make sure that the requests are not blocked.

### Allowed Origins
Please enter a valid RegEx here to validate the origin. If the RegEx is not matched, the request will not be claimed. If you do not want to validate the origin, just leave the default value of "*".