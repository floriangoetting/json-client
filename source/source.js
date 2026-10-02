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
const fromBase64 = require('fromBase64');

const requestParams = getRequestQueryParameters();
const origin = getRequestHeader('origin') || (!!getRequestHeader('referer') && parseUrl(getRequestHeader('referer')).origin) || requestParams.origin;
const UA = getRequestHeader('user-agent');
const HOST = getRequestHeader('host');

const requestPath = getRequestPath();
const requestMethod = getRequestMethod();

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
let isBase64Encoded = false;
if (requestPath === data.requestPath + '/ba') {
    isBase64Encoded = true;
} else if (requestPath !== data.requestPath) {
    return;
}

if (!validateOrigin()) {
    log('Request originated from invalid origin');
    return;
}

// claim the request
claimRequest();

const payloadToEvents = (payload) => {
    if (payload === undefined || payload === null) {
        return null;
    }

    // getRequestBody should return a string, but be defensive
    if (getType(payload) !== 'string') {
        payload = makeString(payload);
    }

    if (isBase64Encoded) {
        // if payload is base64 encoded, decode it
        payload = fromBase64(payload);
        if (payload === undefined || payload === null) {
            return null;
        }
    }

    payload = payload.trim();
    if (payload.length === 0) {
        return null;
    }

    // Note: in the sGTM sandbox, JSON.parse is expected to be safe to call
    const parsedPayload = JSON.parse(payload);
    if (parsedPayload === undefined || parsedPayload === null) {
        return null;
    }

    // If the entire payload is an array -> return directly
    if (getType(parsedPayload) === 'array') {
        return parsedPayload;
    }

    // If it is only a single event -> pack into array
    if (getType(parsedPayload) === 'object') {
        return [parsedPayload];
    }

    return null;
};

const addCommonEventData = (event) => {
    // only set common event data if it was not yet set in the original payload
    if (!event.ip_override) event.ip_override = require('getRemoteAddress')();
    if (origin && !event.origin) event.origin = origin;
    if (!event.host) event.host = HOST;
    if (!event.user_agent) event.user_agent = UA;
    if (!event.timestamp) event.timestamp = getTimestampMillis();

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
    let cookieValue = value;

    if (!cookieValue) {
        // Retrieve the existing cookie value only when no explicit value is provided.
        const existingCookieValues = getCookieValues(cookieName);
        const existingCookie = existingCookieValues.length > 0 ? existingCookieValues[0] : null;
        cookieValue = existingCookie;
    }

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

const deleteCookie = (cookieName, domain, cookiePath, cookieSecure, cookieHttpOnly, cookieSameSite) => {
    setCookie(cookieName, '', {
        'max-age': 0,
        'domain': domain,
        'path': cookiePath,
        'secure': cookieSecure,
        'httpOnly': cookieHttpOnly,
        'sameSite': cookieSameSite
    });
};

const setOrDeleteIdCookie = (cookieSettings, value, shouldSetCookie, shouldDeleteCookie) => {
    if (value && shouldSetCookie) {
        setOrUpdateCookie(
            cookieSettings.name,
            cookieSettings.domain,
            cookieSettings.path,
            cookieSettings.secure,
            cookieSettings.httpOnly,
            cookieSettings.sameSite,
            cookieSettings.duration,
            value
        );
    } else if (shouldDeleteCookie) {
        deleteCookie(
            cookieSettings.name,
            cookieSettings.domain,
            cookieSettings.path,
            cookieSettings.secure,
            cookieSettings.httpOnly,
            cookieSettings.sameSite
        );
    }
};

const extendCookieLifetimes = (excludedCookieNames) => {
    if (typeof data.cookiesToExtend === 'undefined' || data.cookiesToExtend.length === 0) {
        return false;
    }

    for (let i = 0; i < data.cookiesToExtend.length; i++) {
        if (excludedCookieNames && excludedCookieNames.indexOf(data.cookiesToExtend[i].cookieName) > -1) {
            continue;
        }

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

        // Serve Access-Control-Max-Age on the preflight OPTIONS requests
        if (requestMethod === 'OPTIONS') {
            setResponseHeader('Access-Control-Max-Age', '86400');
        }
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
if (requestMethod === 'POST') {
    const events = payloadToEvents(getRequestBody());
    if (events === null) {
        log('Invalid request payload');
        sendResponse(400);
        return;
    }

    const enableDeviceId = data.setDeviceIdCookie; //added for backwards compatibility to older JSON client versions
    const enabledSessionId = data.setSessionIdCookie; //added for backwards compatibility to older JSON client versions
    // consent is only checked if a path to the consent boolean in the event data is configured
    const deviceIdConsentPath = data.deviceIdCookieEnableEventDataPath || null;
    const sessionIdConsentPath = data.sessionIdCookieEnableEventDataPath || null;

    let existingDeviceId = null;
    let existingSessionId = null;
    let existingDeviceIdLoaded = false;
    let existingSessionIdLoaded = false;
    let lastDeviceId = null;
    let lastSessionId = null;
    let shouldSetDeviceIdCookie = false;
    let shouldSetSessionIdCookie = false;
    let shouldDeleteDeviceIdCookie = false;
    let shouldDeleteSessionIdCookie = false;
    let generatedDeviceId = null;
    let generatedSessionId = null;

    const getExistingDeviceId = () => {
        if (!existingDeviceIdLoaded) {
            const existingDeviceIdCookies = getCookieValues(getOrDefault(data.deviceIdCookieName, 'fp_device_id'));
            existingDeviceId = existingDeviceIdCookies.length > 0 ? existingDeviceIdCookies[0] : null;
            existingDeviceIdLoaded = true;
        }
        return existingDeviceId;
    };

    const getExistingSessionId = () => {
        if (!existingSessionIdLoaded) {
            const existingSessionIdCookies = getCookieValues(getOrDefault(data.sessionIdCookieName, 'fp_session_id'));
            existingSessionId = existingSessionIdCookies.length > 0 ? existingSessionIdCookies[0] : null;
            existingSessionIdLoaded = true;
        }
        return existingSessionId;
    };

    const eventPromises = events.map((event) => {
        // only set device id if activated in the JSON client settings
        if (enableDeviceId) {
            const deviceIdCookieEnabled = deviceIdConsentPath ? getValueByPath(event, deviceIdConsentPath) : true;
            if (deviceIdCookieEnabled && !generatedDeviceId) {
                generatedDeviceId = generateUUIDv4();
            }
            const existingConsentedDeviceId = deviceIdCookieEnabled ? getExistingDeviceId() : null;
            const candidateDeviceId = deviceIdCookieEnabled ? generatedDeviceId : data.cookielessDeviceId;

            const selectedDeviceId = event.client_id || existingConsentedDeviceId || candidateDeviceId;
            // prefer client_id from event data, then existing cookie with consent, then consent-based candidate id
            if (selectedDeviceId) {
                event.client_id = selectedDeviceId;
            }
            lastDeviceId = selectedDeviceId || null;
            shouldSetDeviceIdCookie = deviceIdCookieEnabled;
            // only delete the cookie if it is present in the request to avoid unnecessary response headers
            shouldDeleteDeviceIdCookie = !deviceIdCookieEnabled && getExistingDeviceId() !== null;
        }

        // only set session id if activated in the JSON client settings
        if (enabledSessionId) {
            const sessionIdCookieEnabled = sessionIdConsentPath ? getValueByPath(event, sessionIdConsentPath) : true;
            if (sessionIdCookieEnabled && !generatedSessionId) {
                generatedSessionId = getTimestampMillis();
            }
            const existingConsentedSessionId = sessionIdCookieEnabled ? getExistingSessionId() : null;
            const candidateSessionId = sessionIdCookieEnabled ? generatedSessionId : null;

            const selectedSessionId = event.session_id || makeInteger(existingConsentedSessionId) || candidateSessionId;
            // prefer session_id from event data, then existing cookie with consent, then consent-based candidate id
            if (selectedSessionId) {
                event.session_id = selectedSessionId;
            }
            lastSessionId = selectedSessionId || null;
            shouldSetSessionIdCookie = sessionIdCookieEnabled;
            // only delete the cookie if it is present in the request to avoid unnecessary response headers
            shouldDeleteSessionIdCookie = !sessionIdCookieEnabled && getExistingSessionId() !== null;
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
    const responseData = {};
    Promise.all(eventPromises).then((allResponses) => {
        // Filter empty objects from responses
        const filteredResponses = allResponses.filter(resp => {
            return resp && Object.keys(resp).length > 0;
        });
        responseData.responses = filteredResponses; // array of responses from container for each event, may be empty
    }).catch((err) => {
        log('Error while processing events: ' + JSON.stringify(err));
        // in case the promise rejects we will send an error response with status 200 to avoid retries from the client, and include the error message in the response body
        responseData.responses = [];
        responseData.error = err;
    }).finally(() => {
        const deviceIdCookieSettings = {
            name: getOrDefault(data.deviceIdCookieName, 'fp_device_id'),
            domain: getOrDefault(data.deviceIdCookieDomain, 'auto'),
            path: getOrDefault(data.deviceIdCookiePath, '/'),
            secure: getOrDefault(data.deviceIdCookieSecure, true),
            httpOnly: getOrDefault(data.deviceIdCookieHttpOnly, true),
            sameSite: getOrDefault(data.deviceIdCookieSameSite, 'Lax'),
            duration: makeInteger(data.deviceIdCookieLifetime) * 24 * 60 * 60
        };
        const sessionIdCookieSettings = {
            name: getOrDefault(data.sessionIdCookieName, 'fp_session_id'),
            domain: getOrDefault(data.sessionIdCookieDomain, 'auto'),
            path: getOrDefault(data.sessionIdCookiePath, '/'),
            secure: getOrDefault(data.sessionIdCookieSecure, true),
            httpOnly: getOrDefault(data.sessionIdCookieHttpOnly, true),
            sameSite: getOrDefault(data.sessionIdCookieSameSite, 'Lax'),
            duration: makeInteger(data.sessionIdCookieLifetime) * 60
        };

        // Set or delete device/session cookies once using the last tracked consent state
        setOrDeleteIdCookie(deviceIdCookieSettings, lastDeviceId, shouldSetDeviceIdCookie, shouldDeleteDeviceIdCookie);
        setOrDeleteIdCookie(sessionIdCookieSettings, lastSessionId ? makeString(lastSessionId) : null, shouldSetSessionIdCookie, shouldDeleteSessionIdCookie);

        // extend cookie lifetimes for selected cookies
        const excludedCookieNames = [];
        if (shouldDeleteDeviceIdCookie) excludedCookieNames.push(deviceIdCookieSettings.name);
        if (shouldDeleteSessionIdCookie) excludedCookieNames.push(sessionIdCookieSettings.name);
        extendCookieLifetimes(excludedCookieNames);

        // Prepare final response
        responseData.events_processed = events.length;
        responseData.device_id = lastDeviceId;
        responseData.session_id = lastSessionId;

        sendResponse(200, responseData);
    });
} else if (requestMethod === 'OPTIONS') {
    sendResponse(204);
}