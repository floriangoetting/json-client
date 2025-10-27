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
const getTimestampMillis = require('getTimestampMillis');
const logToConsole = require('logToConsole');
const Object = require('Object');
const JSON = require('JSON');
const getType = require('getType');
const parseUrl = require('parseUrl');
const createRegex = require('createRegex');
const testRegex = require('testRegex');
const addMessageListener = require('addMessageListener');
const Promise = require('Promise');

const requestParams = getRequestQueryParameters();
const origin = getRequestHeader('origin') || (!!getRequestHeader('referer') && parseUrl(getRequestHeader('referer')).origin) || requestParams.origin;
const UA = getRequestHeader('user-agent');
const HOST = getRequestHeader('host');

const requestPath = getRequestPath();

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

const payloadToEvents = (payload) => {
  const parsedPayload = JSON.parse(payload);

  // If the entire payload is an array → return directly
  if (getType(parsedPayload) === 'array') {
    return parsedPayload;
  }

  // If it is only a single event → pack into array
  return [parsedPayload];
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

const sendResponse = (statusCode, bodyData) => {
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
    if (statusCode === 200) {
        if (!bodyData || Object.keys(bodyData).length === 0) {
            setResponseBody(JSON.stringify({ status: 'ok' }));
        } else {
            setResponseBody(JSON.stringify(bodyData));
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

const runContainerForEventPromise = (event) => {
    return Promise.create((resolve) => {
        let eventResponseData = {}; // per Event
        let monitorData = [];

        runContainer(event, /*onComplete= */ (bindToEvent) => {
            // server monitor event
            if ((data.monitorFailedTags || data.monitorSuccessfulTags) && event.event_name !== data.monitorEventName) {
                bindToEvent(addEventCallback)((containerId, eventData) => {
                    const tags = eventData.tags.filter(tag => tag.exclude !== 'true');
                    const fTags = tags.filter(tag => tag.status === 'failure');
                    const sTags = tags.filter(tag => tag.status === 'success');

                    const sendEventWithoutCustomData = data.sendMonitorEventWithoutCustomData;
                    const customMonitorDataCheckFailures = monitorData.length === 0 && sendEventWithoutCustomData == 'onlySuccessfulTags' ? false : true;
                    const shouldMonitorFailures = data.monitorFailedTags && fTags.length > 0 && customMonitorDataCheckFailures;
                    const customMonitorDataCheckSuccesses = monitorData.length === 0 && sendEventWithoutCustomData == 'onlyFailedTags' ? false : true;
                    const shouldMonitorSuccesses = data.monitorSuccessfulTags && sTags.length > 0 && customMonitorDataCheckSuccesses;

                    if (shouldMonitorFailures || shouldMonitorSuccesses) {
                        const monitorEvent = JSON.parse(JSON.stringify(event)); // deep clone
                        monitorEvent.event_name_original = event.event_name;
                        monitorEvent.event_name = data.monitorEventName;
                        monitorEvent.monitor = {};

                        if (data.monitorFailedTags && fTags.length > 0) {
                            monitorEvent.monitor.failed_tags = fTags;
                        }
                        if (data.monitorSuccessfulTags && sTags.length > 0) {
                            monitorEvent.monitor.successful_tags = sTags;
                        }
                        if (monitorData.length > 0) {
                            monitorEvent.monitor.services = monitorData;
                        }
                        
                        runContainer(monitorEvent, () => {
                            // log('Monitor Event Fired:', monitorEvent);
                        });
                    }
                });
            }

            resolve(eventResponseData);
        }, /* onStart= */(bindToEvent) => {
            // listener for tag data for response
            bindToEvent(addMessageListener)('send_response', (messageType, message) => {
                if (!eventResponseData.tags) {
                    eventResponseData.tags = {};
                }

                const keys = Object.keys(message);
                if (keys.length > 0) {
                    const tag = keys[0];
                    eventResponseData.tags[tag] = message[tag];
                }
            });
            if (data.monitorFailedTags || data.monitorSuccessfulTags) {
                // listener for monitor data
                bindToEvent(addMessageListener)('server_monitor', (messageType, message) => {
                    monitorData.push(message);
                });
            }
        });
    });
};

// handle the various request methods
const requestMethod = getRequestMethod();
if (requestMethod === 'POST') {
    const events = payloadToEvents(getRequestBody());

    // get existing cookie values
    const existingDeviceIdCookies = getCookieValues(getOrDefault(data.deviceIdCookieName, 'fp_device_id'));
    const existingSessionIdCookies = getCookieValues(getOrDefault(data.sessionIdCookieName, 'fp_session_id'));

    const existingDeviceId = existingDeviceIdCookies.length > 0 ? existingDeviceIdCookies[0] : null;
    const existingSessionId = existingSessionIdCookies.length > 0 ? existingSessionIdCookies[0] : null;

    let lastDeviceId = existingDeviceId;
    let lastSessionId = existingSessionId;

    // Track whether client provided values
    let clientProvidedDeviceId = false;
    let clientProvidedSessionId = false;

    const eventPromises = events.map((event) => {
        // Track device ID if cookie should be set
        if (data.setDeviceIdCookie) {
            const deviceIdCookieEnabled = data.deviceIdCookieEnableEventDataPath ? getValueByPath(event, data.deviceIdCookieEnableEventDataPath) : true;
            if (deviceIdCookieEnabled) {
                // read existing client_id from event data or read existing cookie or generate new cookie value
                if (event.client_id) clientProvidedDeviceId = true;
                event.client_id = event.client_id || existingDeviceId || generateUUIDv4();
                lastDeviceId = event.client_id;
            }
        }

        // Track session ID if cookie should be set
        if (data.setSessionIdCookie) {
            const sessionIdCookieEnabled = data.sessionIdCookieEnableEventDataPath ? getValueByPath(event, data.sessionIdCookieEnableEventDataPath) : true;
            if (sessionIdCookieEnabled) {
                // read existing session_id from event data or read existing cookie or generate new cookie value
                if (event.session_id) clientProvidedSessionId = true;
                event.session_id = event.session_id || existingSessionId || makeString(getTimestampMillis());
                lastSessionId = event.session_id;
            }
        }

        // add common event data
        event = addCommonEventData(event);

        // add batched request indicator
        if (events.length > 1) {
            event.batched_request = event.batched_request || true;
            event.batched_request_size = event.batched_request_size || events.length;
        }

        // run container
        return runContainerForEventPromise(event);
    });

    // After all events processed
    Promise.all(eventPromises).then((allResponses) => {
        // Set device/session cookies once using the last tracked IDs
        if (!clientProvidedDeviceId && lastDeviceId) {
            setOrUpdateCookie(
                getOrDefault(data.deviceIdCookieName, 'fp_device_id'),
                getOrDefault(data.deviceIdCookieDomain, 'auto'),
                getOrDefault(data.deviceIdCookiePath, '/'),
                getOrDefault(data.deviceIdCookieSecure, true),
                getOrDefault(data.deviceIdCookieHttpOnly, true),
                getOrDefault(data.deviceIdCookieSameSite, 'Lax'),
                makeInteger(data.deviceIdCookieLifetime) * 24 * 60 * 60,
                lastDeviceId
            );
        }

        if (!clientProvidedSessionId && lastSessionId) {
            setOrUpdateCookie(
                getOrDefault(data.sessionIdCookieName, 'fp_session_id'),
                getOrDefault(data.sessionIdCookieDomain, 'auto'),
                getOrDefault(data.sessionIdCookiePath, '/'),
                getOrDefault(data.sessionIdCookieSecure, true),
                getOrDefault(data.sessionIdCookieHttpOnly, true),
                getOrDefault(data.sessionIdCookieSameSite, 'Lax'),
                makeInteger(data.sessionIdCookieLifetime) * 60,
                lastSessionId
            );
        }

        // extend cookie lifetimes for selected cookies
        extendCookieLifetimes();

        // Filter empty objects from responses
        const filteredResponses = allResponses.filter(resp => {
            return resp && Object.keys(resp).length > 0;
        });

        // Prepare final response
        const responseData = {
            events_processed: events.length,
            responses: filteredResponses, // always an array, may be empty
            device_id: lastDeviceId,
            session_id: lastSessionId
        };

        sendResponse(200, responseData);
    }).catch((err) => {
        log('Error while processing events: ' + err);
        sendResponse(500, { error: 'internal_error' });
    });
} else if (requestMethod === 'OPTIONS') {
    sendResponse(204);
}