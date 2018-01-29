var restify = require('restify');
var builder = require('botbuilder');
var dateFormat = require('dateformat');


// Watson conversation
var ConversationV1 = require('watson-developer-cloud/conversation/v1');

// Set up Conversation service.
var conversation = new ConversationV1({
    username: 'c9639868-4e4b-45b5-854a-e10fa965eb87', // replace with username from service key
    password: 'eqk1SxAPLkPC', // replace with password from service key
    path: { workspace_id: '3780fe08-ce98-44f0-b5d6-5eb80053c004' }, // replace with workspace ID
    version_date: '2017-05-26'
});


// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users
server.post('/api/messages', connector.listen());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var bot = new builder.UniversalBot(connector, [
    // default dialog, call default dailog function here
    function (session) {
        session.beginDialog('welcomeDialog')
    },
    function (session, results) {
        if (results.response) {
          session.beginDialog('intentIdentificationDialog', results.response)
        } else {
          console.error('No results back from welcomeDialog')
        }

    }
]);

// use args param to send welcome message to user
bot.dialog('welcomeDialog', [
    function(session, args, next) {
        conversation.message({
            input: {'text': 'Hello'}
        },  function(err, response) {
          if (err) {
            console.error(err); // something went wrong
          }
            // intent detection
            if (response.intents.length > 0 && response.intents[0].intent === 'Greeting') {
                session.send(response.output.text)
                session.endDialogWithResult({
                  response: { context: response.context}
                });
            }
        })
    }
]);


// return watson context if intent correctly identified as RequestStudioVisit
// otherwise sit here until we identify the intent correctly
bot.dialog('intentIdentificationDialog',[
    function (session, args) {
      builder.Prompts.choice(session, "Would you like to request a visit to Liquid Studio Stockholm?", "Yes|No", { listStyle: builder.ListStyle.button })
    }, function (session, results, next) {
      console.log('Visist request prompt results:', results)
      if (results.response.entity === 'Yes') {
        session.beginDialog('visitStudioIntent')
      } else {
        session.endConversation()
      }
    }
]);

bot.dialog('visitStudioIntent', function (session, args, next) {
  var watsonContext = ''
  var datePrompt = ''
  conversation.message({
      input: {'text': 'I want to visit Liquid Studio'},
      context: args
  },  function(err, response) {
      if (err)
          console.log('error:', err);
      else
          console.log(JSON.stringify(response, null, 2));

      // intent detection
      if (response.intents.length > 0 && response.intents[0].intent === 'RequestStudioVisit') {
          watsonContext = response.context
          datePrompt = response.output.text[0]
          session.conversationData.watsonContext = response.context
          session.beginDialog('gatherVisitInfo')
      }
  })
})
.triggerAction({
    matches: /^I want to visit Liquid Studio$/i,
});

// go through the Dialog as configured on IBM Watson
bot.dialog('gatherVisitInfo', [
    function(session, results, next) {
      session.beginDialog('visitDate')
    }, function (session, results, next) {
      session.beginDialog('numberOfVisitors')
    },function (session, results, next) {
      session.beginDialog('topic')
    },function (session, results, next) {
      session.beginDialog('contactInfo')
    },function (session, results, next) {
      session.beginDialog('visitType')
    },function (session, results, next) {
      conversation.message({
          input: {
              'text': 'I want to visit Liquid Studio'
          },
          context: session.conversationData.watsonContext
      },  function(err, response) {
          if (err) {
              console.log('error:', err);
          } else {
              session.conversationData.watsonContext = response.context
              console.log(JSON.stringify(response, null, 2));
              session.dialogData.userPrompt = response.output.text[0]
          }
          next()
      })
    },function (session, results, next) {
      builder.Prompts.choice(session, session.dialogData.userPrompt, "Yes|No", { listStyle: builder.ListStyle.button })
    },function (session, results) {
        if (results.response.entity === 'Yes') {
            createRequest(session)
        } else {
          session.send('Let\'s check the details.')
          session.beginDialog('editVisitInfo')
        }
    }
]).triggerAction({
    matches: /^pick my own date and time$/i,
});

// confirm one by one all the stuff they've entered
bot.dialog('editVisitInfo', [
  function (session, args, next) {
    builder.Prompts.choice(session, 'Please confirm date: '+session.conversationData.watsonContext.dateOfVisit , "Yes|No", { listStyle: builder.ListStyle.button })
  },function (session, results, next) {
      if (results.response.entity === 'Yes') {
            next()
      } else {
        session.beginDialog('visitDate')
      }
  },function (session, results, next) {
    builder.Prompts.choice(session, 'Please confirm number of people: '+session.conversationData.watsonContext.number , "Yes|No", { listStyle: builder.ListStyle.button })
  },function (session, results, next) {
      if (results.response.entity === 'Yes') {
            next()
      } else {
        session.beginDialog('numberOfVisitors')
      }
  },function (session, results, next) {
    builder.Prompts.choice(session, 'Please confirm topic: '+session.conversationData.watsonContext.topic , "Yes|No", { listStyle: builder.ListStyle.button })
  },function (session, results, next) {
      if (results.response.entity === 'Yes') {
            next()
      } else {
        session.beginDialog('topic')
      }
  },function (session, results, next) {
    builder.Prompts.choice(session, 'Please confirm your email: '+session.conversationData.watsonContext.contactInfo , "Yes|No", { listStyle: builder.ListStyle.button })
  },function (session, results, next) {
      if (results.response.entity === 'Yes') {
            next()
      } else {
        session.beginDialog('contactInfo')
      }
  },function (session, results, next) {
    builder.Prompts.choice(session, 'Please confirm your visit type: '+session.conversationData.watsonContext.visitType , "Yes|No", { listStyle: builder.ListStyle.button })
  },function (session, results, next) {
      if (results.response.entity === 'Yes') {
            next()
      } else {
        session.beginDialog('visitType')
      }
  },function (session, results, next) {
      console.log('Everything is confirmed, ready to send out mails!')
      createRequest(session)
  }
])


function createRequest(session) {
  var dateVisit = new Date(session.conversationData.watsonContext.dateOfVisit)
  // if we have a valid date, create calendar event
  if (dateVisit != 'Invalid Date') {
    createGoogleCalEvent(session.conversationData.watsonContext.dateOfVisit,
                  session.conversationData.watsonContext.number,
                   session.conversationData.watsonContext.topic,
                   session.conversationData.watsonContext.contactInfo,
                   session.conversationData.watsonContext.visitType)

  }

 emailText = 'Preliminary request details for visiting Liquid Studio Stockholm:\n' +
              'On ' + session.conversationData.watsonContext.dateOfVisit + '\n'
                   +  session.conversationData.watsonContext.number +
              ' people would like to visit the Studio.\n' +
              'Visit Type is ' + session.conversationData.watsonContext.visitType + '.\n' +
              'The topic of interest is ' + session.conversationData.watsonContext.topic + '.\n' +
              'Contact info: ' + session.conversationData.watsonContext.contactInfo

  var gmail = require('./quickstart_gmail.js');
  gmail.sendMail(emailText, session.conversationData.watsonContext.contactInfo)
  session.send('Thank you, our team will get in touch regarding your request. PLEASE NOTE: this does not constitute a booking, this is a request, someone from Liquid Studio will be in touch with regarding this soon. ')
  session.endConversation()
}

bot.dialog('visitDate', [
  function (session, args, next) {
    builder.Prompts.choice(session, "Do you know the exact date for your visit?", "Yes|No", { listStyle: builder.ListStyle.button })
  },function(session, results, next) {
    if (results.response.entity === 'Yes') {
      session.beginDialog('getExactVisitDate')
    } else {
      session.beginDialog('getFreeTextVisitDate')
    }
  },function(session, results, next) {
    session.endDialog()
  }
])

bot.dialog('getExactVisitDate', [
  function(session, args, next) {
    builder.Prompts.time(session, 'What date and time do you have in mind (format: yyyy-mm-dd HH:MM, eg: 2018-03-25 15:30)?');
  },
  // now we have the date, confirm it?
  function (session, results, next) {
      dateOfVisit = results.response.entity;
      var dateNow = new Date();
      var dateGiven = new Date(dateOfVisit);

      if (dateGiven.getTime() - dateNow.getTime() <= 0) {
        session.send('The given date occurs in the past.')
        session.replaceDialog('getExactVisitDate');
      } else {
        // { listStyle: builder.ListStyle.button }
        builder.Prompts.choice(session, "Please confirm date "+ dateFormat(dateOfVisit, 'yyyy-mm-dd HH:MM'), "Yes|No", { listStyle: builder.ListStyle.button })

      }
  },function(session, results, next) {
    if (results.response.entity === 'Yes') {
      dateOfVisit = dateFormat(dateOfVisit, 'yyyy-mm-dd HH:MM')
      session.conversationData.watsonContext.dateOfVisit =  dateOfVisit
      next()
    } else {
      session.replaceDialog('getExactVisitDate');
    }
  },function (session, results, next) {
      //checkDateAvailability(utcDate, next)
      fs.readFile('client_secret.json', function processClientSecrets(err, content) {
        if (err) {
          console.log('Error loading client secret file: ' + err);
          return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Calendar API.
        authorize(JSON.parse(content), isDateAvailable, session.conversationData.watsonContext.dateOfVisit, function(isClash) {
            if (isClash) {
              console.log('callbacking with true')
              session.endDialog()
            } else {
              //builder.Prompts.text(session, 'That date is already booked, please try another.');
              session.send('That date is already booked, please try another.')
              session.replaceDialog('getExactVisitDate');
            }
        });
      });
  }
])

bot.dialog('getFreeTextVisitDate', [
  function(session, args, next) {
    builder.Prompts.text(session, 'Please give a general indication of the date:')
  },function(session, results, next) {
      session.conversationData.watsonContext.dateOfVisit = results.response
      session.endDialog()
  }
])

bot.dialog('numberOfVisitors', [
    function(session, args, next) {
      builder.Prompts.number(session, "How many people in the group?");
    },
    function(session, results) {
      numberOfVisitors = results.response
      session.conversationData.watsonContext.number = numberOfVisitors
      session.endDialog()
    }
])



bot.dialog('topic', [
    function(session, args, next) {
      builder.Prompts.text(session, "What topic are you interested in?");
    },
    function(session, results) {
      topic = results.response
      session.conversationData.watsonContext.topic = topic
      session.endDialog()
    }
])


bot.dialog('contactInfo', [
    function(session, args, next) {
      builder.Prompts.text(session, "Please provide your email in order for us to be able to contact you regarding your request:");
    },
    function(session, results) {
      // if they gave us a funny email address, ask again, else confirm email
      if (!validateEmail(results.response)) {
        session.send('Invalid email address supplied.')
        session.replaceDialog('contactInfo');
      } else if (!isAccentureEmail(results.response)) {
        session.send('Please supply Accenture email.')
        session.replaceDialog('contactInfo');
      } else {
        contactInfo = results.response
        builder.Prompts.choice(session, "Please confirm your email is "+ contactInfo, "Yes|No", { listStyle: builder.ListStyle.button })
      }
    },function(session, results, next) {
      if (results.response.entity === 'Yes') {
        session.conversationData.watsonContext.contactInfo = contactInfo
        session.endDialog()
      } else {
        session.replaceDialog('contactInfo');
      }
    }
])

function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email.toLowerCase());
}

function isAccentureEmail(email) {
  return email.endsWith('accenture.com');
}

bot.dialog('visitType', [
    function(session, args) {
      builder.Prompts.choice(session, "Please give some details about your request. Is it:", "Accenture Internal|Client|Other", { listStyle: builder.ListStyle.button })
    }, function(session, results, next) {
      other = false
      if (results.response.entity === 'Accenture Internal') {
        session.beginDialog('accentureInternal')
      } else if (results.response.entity === 'Client') {
        session.beginDialog('clientVisit')
      } else if (results.response.entity === 'Other') {
        session.beginDialog('specifyOther')
        other = true
      }
    }, function(session, results, next) {
        if (other) {
          session.conversationData.watsonContext.visitType = 'Visit type: ' + results.response
        }
        session.endDialog()
    }
])

bot.dialog('clientVisit', [
  function(session, args) {
    builder.Prompts.text(session, 'Please specify client name:')
  }, function(session, results) {
    clientName = results.response
    session.conversationData.watsonContext.visitType = 'Client visit, name: ' + clientName
    session.endDialog()
  }
])
.triggerAction({
    matches: /^Client$/i,
});

bot.dialog('accentureInternal', [
  function(session, args) {
    builder.Prompts.choice(session, "Please choose internal visit type:", "Recruiting|Onboarding|New Joiner|Other", { listStyle: builder.ListStyle.button })
  }, function(session, results, next) {
    selection = results.response.entity
    if (results.response.entity === 'Other')  {
      session.beginDialog('specifyOther')
    }
    next()
  }, function(session, results) {
      if (results.response) {
        session.conversationData.watsonContext.visitType = 'Accenture Internal, ' + results.response
      } else {
        session.conversationData.watsonContext.visitType = 'Accenture Internal, ' + selection
      }

      session.endDialog()
  }
])
.triggerAction({
    matches: /^Accenture Internal$/i,
});

bot.dialog('specifyOther', [
  function(session, args) {
    builder.Prompts.text(session, 'Please specify:')
  }, function(session, results) {
    session.endDialogWithResult(results)
  }
])

/*
 *
 *
Google Calendar Stuff below here:
*
*
*/

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
// var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var SCOPES = ['https://www.googleapis.com/auth/calendar'];

var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
console.log('TOKEN_DIR: ', TOKEN_DIR)
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';



function createGoogleCalEvent(dateOfVisit, numberOfVisitors, topic, contactInfo, visitType) {
  fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Google Calendar API.
    authorize(JSON.parse(content), insertEvent, dateOfVisit, numberOfVisitors, topic, contactInfo, visitType);
  });
}

// get first available day from google calendar

function getFirstAvailableGoogleCalEvent() {
  fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Google Calendar API.
    authorize(JSON.parse(content), listEvents);
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, dateOfVisit, numberOfVisitors, topic, contactInfo, visitType) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client, dateOfVisit, numberOfVisitors, topic, contactInfo, visitType);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  var calendar = google.calendar('v3');
  calendar.events.list({
    auth: auth,
    calendarId: '2aj60sad7jl7m8gvm84m6i3e9s@group.calendar.google.com',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.items;
    if (events.length == 0) {
      console.log('No upcoming events found.');
    } else {
      console.log('Upcoming 10 events:');
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var start = event.start.dateTime || event.start.date;
        console.log('%s - %s', start, event.summary);
      }
    }
  });
}


function isDateAvailable(auth, dateOfVisit, callback) {
  var calendar = google.calendar('v3');
  timeMin = new Date(dateOfVisit)
  timeMax = (new Date(dateOfVisit))
  timeMax.setHours(timeMax.getHours() + 1)
  calendar.events.list({
    auth: auth,
    calendarId: '2aj60sad7jl7m8gvm84m6i3e9s@group.calendar.google.com',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      callback(err);
    }
    var events = response.items;
    if (events.length == 0) {
      console.log('No clashing events found.');
      noClash = true
      callback(noClash)
    } else {
      console.log('Clashing events:');
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var start = event.start.dateTime || event.start.date;
        console.log('%s - %s', start, event.summary);
      }
      noClash = false
      callback(noClash)
    }
  });
}


function insertEvent(auth, dateOfVisit, numberOfVisitors, topic, contactInfo, visitType) {
  var startDate = new Date(dateOfVisit);
  console.log('startDate:', startDate)

  endDate = new Date(startDate)
  endDate.setHours(endDate.getHours() + 1);
  console.log('endDate:', endDate)

  var event = {
    'summary': numberOfVisitors + ' interested in ' + topic,
    'location': 'Liquid Studio Stockholm',
    'description': 'Visit type:' + visitType + '. Contact info: ' + contactInfo,
    'start': {
      'dateTime': startDate,
      //'timeZone': 'UTC+01:00',
    },
    'end': {
      'dateTime': endDate,
      //'timeZone': 'UTC+01:00',
    },
  };

  var calendar = google.calendar('v3');

  calendar.events.insert({
    auth: auth,
    calendarId: '2aj60sad7jl7m8gvm84m6i3e9s@group.calendar.google.com',
    resource: event,
  }, function(err, event) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    console.log('Event created: %s', event.htmlLink);
  });
}



/**
 * Send Message.
 *
 * @param  {String} userId User's email address. The special value 'me'
 * can be used to indicate the authenticated user.
 * @param  {String} email RFC 5322 formatted String.
 * @param  {Function} callback Function to call when the request is complete.
 */
function sendMessage(userId, email, callback) {
  // Using the js-base64 library for encoding:
  // https://www.npmjs.com/package/js-base64
  var base64EncodedEmail = Base64.encodeURI(email);
  var request = gapi.client.gmail.users.messages.send({
    'userId': userId,
    'resource': {
      'raw': base64EncodedEmail
    }
  });
  request.execute(callback);
}
