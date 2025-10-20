const setCookie = require('setCookie');
const getCookieValues = require('getCookieValues');
const makeString = require('makeString');
const makeInteger = require('makeInteger');
const claimRequest = require('claimRequest');
const returnResponse = require('returnResponse');
const getRequestBody = require('getRequestBody');
const addEventCallback = require('addEventCallback');
const runContainer = require('runContainer');
const setResponseHeader = require('setResponseHeader');
const setResponseStatus = require('setResponseStatus');
const setResponseBody = require('setResponseBody');
const getRequestHeader = require('getRequestHeader');
const getRequestPath = require('getRequestPath');
const getRequestMethod = require('getRequestMethod');
const getRequestQueryParameters = require('getRequestQueryParameters');
const generateRandom = require('generateRandom');
const getTimestamp = require('getTimestamp');
const logToConsole = require('logToConsole');
const Object = require('Object');
const JSON = require('JSON');
const getType = require('getType');
const parseUrl = require('parseUrl');
const createRegex = require('createRegex');
const testRegex = require('testRegex');
const addMessageListener = require('addMessageListener');

const requestParams = getRequestQueryParameters();
const origin = getRequestHeader('origin') || (!!getRequestHeader('referer') && parseUrl(getRequestHeader('referer')).origin) || requestParams.origin;
const UA = getRequestHeader('user-agent');
const HOST = getRequestHeader('host');

const requestPath = getRequestPath();

let responseData = {};
let monitorData = false;

const log = msg => {
    logToConsole('[JSON Client] ' + msg);
};

const validateOrigin = () => {
    // if no origin is present, skip origin validation
    if (!origin) {
        return true;
    }
    const allowedOriginsRegEx = createRegex(data.allowedOrigins, 'i');
    return data.allowedOrigins === '*' || (allowedOriginsRegEx !== null && testRegex(allowedOriginsRegEx, origin));
};

// check if client should claim the request
if (requestPath === data.requestPath) {
    if (!validateOrigin()) {
        log('Request originated from invalid origin');
        return;
    }
    // claim the request
    claimRequest();
} else {
    return;
}

const payloadToEvent = (payload) => {
    const event = JSON.parse(payload);
    if (getType(event) === 'object' && getType(event.data) === 'array') {
        return { events: event.data };
    }
    return event;
};

const addCommonEventData = (event) => {
    // only set common event data if it was not yet set in the original payload
    if (!event.ip_override) event.ip_override = require('getRemoteAddress')();
    if (origin && !event.origin) event.origin = origin;
    if (!event.host) event.host = HOST;
    if (!event.user_agent) event.user_agent = UA;

    return event;
};

// Function to generate a UUID v4 without crypto and without regex
const generateUUIDv4 = () => {
    let uuid = '';
    const hexDigits = '0123456789abcdef';

    for (let i = 0; i < 36; i++) {
        if (i === 14) {
            uuid += '4'; // UUID Version 4
        } else if (i === 19) {
            uuid += (8 + generateRandom(0, 3)).toString(16);
        } else if (i === 8 || i === 13 || i === 18 || i === 23) {
            uuid += '-';
        } else {
            uuid += hexDigits[generateRandom(0, 15)];
        }
    }
    return uuid;
};

const setOrUpdateCookie = (cookieName, domain, cookiePath, cookieSecure, cookieHttpOnly, cookieSameSite, duration, value) => {
    // Retrieve the existing cookie value
    const existingCookieValues = getCookieValues(cookieName);
    const existingCookie = existingCookieValues.length > 0 ? existingCookieValues[0] : null;

    // Generate a new value if no existing cookie is found
    const cookieValue = existingCookie || value;

    // cookie value might be null or false if no existing cookie is found and no new cookie value is specified
    if (!cookieValue) return false;

    // Set the cookie
    setCookie(cookieName, cookieValue, {
        'max-age': duration,
        'domain': domain,
        'path': cookiePath,
        'secure': cookieSecure,
        'httpOnly': cookieHttpOnly,
        'sameSite': cookieSameSite
    });

    return cookieValue;
};

const extendCookieLifetimes = () => {
    if (typeof data.cookiesToExtend === 'undefined' || data.cookiesToExtend.length === 0) {
        return false;
    }

    for (let i = 0; i < data.cookiesToExtend.length; i++) {
        //the maximum duration of 400 days is used, no value is passed to avoid creating new cookies
        setOrUpdateCookie(
            data.cookiesToExtend[i].cookieName,
            data.cookiesToExtend[i].cookieDomain,
            data.cookiesToExtend[i].cookiePath,
            data.cookiesToExtend[i].cookieSecure,
            data.cookiesToExtend[i].cookieHttpOnly,
            data.cookiesToExtend[i].cookieSameSite,
            400 * 24 * 60 * 60);
    }
};

const sendResponse = (statusCode) => {
    // Prevent CORS errors
    if (data.enableCors) {
        setResponseHeader('Access-Control-Allow-Origin', origin);
        setResponseHeader('Access-Control-Allow-Credentials', 'true');
        setResponseHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Content-Encoding, Accept-Encoding, X-Gtm-Server-Preview, X-Keepalive-Request'
        );
        setResponseHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
    setResponseHeader('Content-Type', 'application/json;charset=UTF-8');
    setResponseStatus(statusCode || 200);

    // set response body
    if (statusCode == 200) {
        if (Object.keys(responseData).length === 0) {
            setResponseBody(JSON.stringify({ status: 'ok' }));
        } else {
            setResponseBody(JSON.stringify(responseData));
        }
    }

    returnResponse();
};

const getValueByPath = (obj, path) => {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length; i++) {
        if (current === undefined || current === null) {
            return undefined;
        }
        current = current[parts[i]];
    }
    return current;
};

const getOrDefault = (val, def) => {
    return typeof val === 'undefined' ? def : val;
};

// handle the request
let event;
// handle the various request methods
const requestMethod = getRequestMethod();
if (requestMethod === 'POST') {
    event = payloadToEvent(getRequestBody());
    // Set device cookie
    if (data.setDeviceIdCookie) {
        const deviceIdCookieEnabled = data.deviceIdCookieEnableEventDataPath ? getValueByPath(event, data.deviceIdCookieEnableEventDataPath) : true;

        if (deviceIdCookieEnabled) {
            // priotize client-side set device id if it is set
            const eventClientId = event.client_id;

            // Only set cookie if NO client-side value was sent
            if (!eventClientId) {
                event.client_id = setOrUpdateCookie(
                    getOrDefault(data.deviceIdCookieName, 'fp_device_id'),
                    getOrDefault(data.deviceIdCookieDomain, 'auto'),
                    getOrDefault(data.deviceIdCookiePath, '/'),
                    getOrDefault(data.deviceIdCookieSecure, true),
                    getOrDefault(data.deviceIdCookieHttpOnly, true),
                    getOrDefault(data.deviceIdCookieSameSite, 'Lax'),
                    makeInteger(data.deviceIdCookieLifetime) * 24 * 60 * 60,
                    generateUUIDv4()
                );
            }
            // set response
            responseData.device_id = event.client_id;
        }
    }

    // set session cookie
    if (data.setSessionIdCookie) {
        const sessionIdCookieEnabled = data.sessionIdCookieEnableEventDataPath ? getValueByPath(event, data.sessionIdCookieEnableEventDataPath) : true;

        if (sessionIdCookieEnabled) {
            // priotize client-side set session id if it is set
            const eventSessionId = event.session_id;

            // Only set cookie if NO client-side value was sent
            if (!eventSessionId) {
                event.session_id = setOrUpdateCookie(
                    getOrDefault(data.sessionIdCookieName, 'fp_session_id'),
                    getOrDefault(data.sessionIdCookieDomain, 'auto'),
                    getOrDefault(data.sessionIdCookiePath, '/'),
                    getOrDefault(data.sessionIdCookieSecure, true),
                    getOrDefault(data.sessionIdCookieHttpOnly, true),
                    getOrDefault(data.sessionIdCookieSameSite, 'Lax'),
                    makeInteger(data.sessionIdCookieLifetime) * 60,
                    makeString(getTimestamp())
                );
            }
            // set response
            responseData.session_id = event.session_id;
        }
    }
    // add common event data
    event = addCommonEventData(event);
    // extend cookie lifetimes for selected cookies
    extendCookieLifetimes();
    // run container
    if (event) {
        runContainer(event, /*onComplete= */ (bindToEvent) => {
            sendResponse(200);
            // server monitor event
            if ((data.monitorFailedTags || data.monitorSuccessfulTags) && event.event_name !== data.monitorEventName) {
                bindToEvent(addEventCallback)((containerId, eventData) => {
                    const tags = eventData.tags.filter(tag => tag.exclude !== 'true');
                    const fTags = tags.filter(tag => tag.status === 'failure');
                    const sTags = tags.filter(tag => tag.status === 'success');

                    const sendEventWithoutCustomData = data.sendMonitorEventWithoutCustomData;
                    const customMonitorDataCheckFailures = !monitorData && sendEventWithoutCustomData == 'onlySuccessfulTags' ? false : true;
                    const shouldMonitorFailures = data.monitorFailedTags && fTags.length > 0 && customMonitorDataCheckFailures;
                    const customMonitorDataCheckSuccesses = !monitorData && sendEventWithoutCustomData == 'onlyFailedTags' ? false : true;
                    const shouldMonitorSuccesses = data.monitorSuccessfulTags && sTags.length > 0 && customMonitorDataCheckSuccesses;

                    if (shouldMonitorFailures || shouldMonitorSuccesses) {
                        const monitorEvent = event;
                        monitorEvent.event_name_original = event.event_name;
                        monitorEvent.event_name = data.monitorEventName;
                        monitorEvent.monitor = {};

                        if (data.monitorFailedTags && fTags.length > 0) {
                            monitorEvent.monitor.failed_tags = fTags;
                        }
                        if (data.monitorSuccessfulTags && sTags.length > 0) {
                            monitorEvent.monitor.successful_tags = sTags;
                        }
                        if (monitorData) {
                            monitorEvent.monitor.services = monitorData;
                        }

                        runContainer(monitorEvent, () => {
                            // log('Monitor Event Fired:', monitorEvent);
                        });
                    } else {
                        // log('No monitor event fired – no relevant tags.');
                    }
                });
            }
        }, /* onStart= */(bindToEvent) => {
            // listener for tag data for response
            bindToEvent(addMessageListener)('send_response', (messageType, message) => {
                if (!responseData.tags) {
                    responseData.tags = {};
                }

                const keys = Object.keys(message);
                if (keys.length > 0) {
                    const tag = keys[0];
                    responseData.tags[tag] = message[tag];
                }
            });
            if (data.monitorFailedTags || data.monitorSuccessfulTags) {
                // listener for monitor data
                bindToEvent(addMessageListener)('server_monitor', (messageType, message) => {
                    if (!monitorData) {
                        monitorData = [];
                    }

                    monitorData.push(message);
                });
            }
        });
    }
} else if (requestMethod === 'OPTIONS') {
    sendResponse(204);
}