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

    },
    // gather studio visit info
    function (session, results, next) {
      if(session.dialogData.time) {
        console.log('========== Time has been set to ', session.dialogData.time)
      }


      if (results.response) {
        console.log('intentIdentificationDialog results:', results.respsonse)
        //session.beginDialog('gatherStudioVisitInfo', results.respsonse)
      } else {
        console.error('No results back from intentIdentificationDialog')
      }
    },
    function (session, results, next) {
      session.endConversation('Goodbye!')
    }
    // send notification
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
          console.log('****************', JSON.stringify(response, null, 2), '****************');

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
bot.dialog('intentIdentificationDialog',
    function (session, args, next) {
      var msg = new builder.Message(session);
      msg.attachments([
        new builder.HeroCard(session)
               .text("Would you like to book a visit to the Studio?")
               .buttons([
                   builder.CardAction.imBack(session, "I want to visit Liquid Studio", "yes"),
                   builder.CardAction.imBack(session, "don't book visit", "no")
               ])
      ]);
      session.send(msg).endDialog();
    }
)

bot.dialog('dontBookVisit', function (session, args, next) {
    session.endConversation()
}).triggerAction({
    matches: /^don't book visit$/i,
});

bot.dialog('visitStudioIntent', function (session, args, next) {
  var watsonContext = ''
  var datePrompt = ''
  conversation.message({
      input: {'text': session.message.text},
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
          console.log('We are returning the following tings', response.context, response.output.text[0])
          session.conversationData.watsonContext = response.context
          console.log('persisted watson context as:', session.conversationData.watsonContext)
          session.beginDialog('visitDate')
      }
  })
})
.triggerAction({
    matches: /^I want to visit Liquid Studio$/i,
});

// probably shouldn't be letting them choose first available
// just ask which date they want
bot.dialog('pickDate',
    function (session, args, next) {
      var msg = new builder.Message(session);
      msg.attachments([
        new builder.HeroCard(session)
               .text("Would you like to pick a date or choose the first avialble one?")
               .buttons([
                   builder.CardAction.imBack(session, "pick my own date and time", "pick my own date and time"),
                   builder.CardAction.imBack(session, "choose first available", "choose first available")
               ])
      ]);
      session.send(msg).endDialog();
    }
)

// go through the Dialog as configured on IBM Watson
bot.dialog('visitDate', [
    function (session, args, next) {
        // this should ask for the date
        builder.Prompts.time(session, 'What date and time do you have in mind (format: yyyy-mm-dd HH:MM, eg: 2018-03-25 15:30)?');
    },
    // now we have the date, confirm it?
    function (session, results, next) {
        console.log('date is:', results);
        dateOfVisit = results.response.entity;
        var dateNow = new Date();
        var dateGiven = new Date(dateOfVisit);

        console.log('dateNow.now()', dateNow.getTime())
        console.log('dateGiven.now()', dateGiven.getTime())
        if (dateGiven.getTime() - dateNow.getTime() <= 0) {
          console.log('go and get the date again');
          session.send('The given date occurs in the past.')
          session.replaceDialog('visitDate');
        } else {
          builder.Prompts.confirm(session, 'Please confirm the date is ' + dateFormat(dateOfVisit, 'yyyy-mm-dd HH:MM'))
          dateOfVisit = dateFormat(dateOfVisit, 'yyyy-mm-dd HH:MM')
        }
    },function (session, results, next) {
        if (results.response) {
          session.conversationData.watsonContext.dateOfVisit =  (new Date(dateOfVisit)).toString()
        } else {
            console.log('go and get the date again');
            session.replaceDialog('visitDate');
        }
        next()
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
                next()
              } else {
                console.log('date clash problem, lets get another date!');
                //builder.Prompts.text(session, 'That date is already booked, please try another.');
                session.send('That date is already booked, please try another.')
                session.replaceDialog('visitDate');
              }
          });
        });
    }
    ,function (session, results, next) {
      session.beginDialog('numberOfVisitors')
    },function (session, results, next) {
      session.beginDialog('topic')
    },function (session, results, next) {
      session.beginDialog('contactInfo')
    },function (session, results, next) {
      session.beginDialog('additionalNotes')
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
      // this should be the overall confirmation message from Watson
      builder.Prompts.confirm(session, session.dialogData.userPrompt)
    },function (session, results) {
        if (results.response) {
            // go and check the calendar
            createGoogleCalEvent(session.conversationData.watsonContext.dateOfVisit,
                          session.conversationData.watsonContext.number,
                           session.conversationData.watsonContext.topic,
                           session.conversationData.watsonContext.contactInfo,
                           session.conversationData.watsonContext.visitType)

           emailText = 'On ' + session.conversationData.watsonContext.dateOfVisit + '\n'
                             +  session.conversationData.watsonContext.number +
                        ' people would like to visit the Studio.\n' +
                        'Visit Type is ' + session.conversationData.watsonContext.visitType + '.\n' +
                        'The topic of interest is ' + session.conversationData.watsonContext.topic + '.\n' +
                        'Contact info: ' + session.conversationData.watsonContext.contactInfo



            var gmail = require('./quickstart_gmail.js');
            gmail.sendMail(emailText, session.conversationData.watsonContext.contactInfo)

            session.endConversation()
        } else {
          session.send('Let\'s start over.')
          session.replaceDialog('visitDate')
        }
    }
]).triggerAction({
    matches: /^pick my own date and time$/i,
});

bot.dialog('chooseFirstAvailable', [
  function(session, results) {
    getFirstAvailableGoogleCalEvent()
  }

]).triggerAction({
    matches: /^choose first available$/i,
});

bot.dialog('numberOfVisitors', [
    function(session, args, next) {
      builder.Prompts.number(session, "How many people in the group?");
    },
    function(session, results) {
      console.log('number of people:', results);
      builder.Prompts.confirm(session, 'Please confirm the number of people is ' + results.response)
      numberOfVisitors = results.response
      console.log('numberOfVisitors is:', numberOfVisitors)
    },function (session, results) {
        if (results.response) {
          session.conversationData.watsonContext.number = numberOfVisitors
          session.endDialog()
        } else {
            console.log('go and get the number of the people again');
            session.replaceDialog('numberOfVisitors');
        }
    }
])



bot.dialog('topic', [
    function(session, args, next) {
      builder.Prompts.text(session, "What topic are you interested in?");
    },
    function(session, results) {
      console.log('number of people:', results);
      builder.Prompts.confirm(session, 'Please confirm the topic is: ' + results.response)
      topic = results.response
      console.log('topic is:', topic)
    },function (session, results) {
        if (results.response) {
          session.conversationData.watsonContext.topic = topic
          session.endDialog()
        } else {
            session.replaceDialog('topic');
        }
    }
])


bot.dialog('contactInfo', [
    function(session, args, next) {
      builder.Prompts.text(session, "Please provide your email in order for us to be able to contact you regarding your request:");
    },
    function(session, results) {
      console.log('contact:', results);
      // if they gave us a funny email address, ask again, else confirm email
      if (!validateEmail(results.response)) {
        session.send('Invalid email address supplied.')
        session.replaceDialog('contactInfo');
      } else {
        builder.Prompts.confirm(session, 'Please confirm your email: ' + results.response)
        contactInfo = results.response
        console.log('contactInfo is:', contactInfo)
      }
    },function (session, results) {
        if (results.response) {
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

bot.dialog('additionalNotes', [
    function(session, args) {
      builder.Prompts.choice(session, "Please give some details about your request. Is it:", "Accenture Internal|Client|Other", { listStyle: builder.ListStyle.button })
    }, function(session, results, next) {
      other = false
      console.log('results', results)
      if (results.response.entity === 'Accenture Internal') {
        console.log('Accenture Internal')
        session.beginDialog('accentureInternal')
      } else if (results.response.entity === 'Client') {
        console.log('Client')
        session.beginDialog('clientVisit')
      } else if (results.response.entity === 'Other') {
        console.log('Other')
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
    builder.Prompts.confirm(session, 'Please confirm client name: ' + results.response)
    clientName = results.response
  },function (session, results) {
      if (results.response) {
        session.conversationData.watsonContext.visitType = 'Client visit, name: ' + clientName
        session.endDialog()
      } else {
          session.replaceDialog('clientVisit');
      }
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
      console.log('============ results:', results)
      if (results.response) {
        console.log('Accenture Internal, results.response:' + results.response)
        session.conversationData.watsonContext.visitType = 'Accenture Internal, ' + results.response
      } else {
        console.log('Accenture Internal, selection:' + selection)
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
bot.dialog('otherVisit', [
  function(session, args) {
    builder.Prompts.text(session, 'Please specify visit type:')
  }, function(session, results) {
    builder.Prompts.confirm(session, 'Please confirm visit type: ' + results.response)
    visitInfo = results.response
  },function (session, results) {
      if (results.response) {
        session.conversationData.watsonContext.additionalNotes = 'Other visit: ' + visitInfo
        session.endDialog()
      } else {
          session.replaceDialog('otherVisit');
      }
  }
])
.triggerAction({
    matches: /^Other$/i,
});
*/

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
  console.log('createGoogleCalEvent')
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

/*
function checkDateAvailability(dateOfVisit) {
  fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file: ' + err);
      return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Google Calendar API.
    authorize(JSON.parse(content), isDateAvailable, dateOfVisit, function(isClash) {
        if (isClash) {
          console.log('callbacking with true')
          next()
        } else {
          console.log('date clash problem, lets get another date!');
          builder.Prompts.text(session, 'That date is already booked, please try another.');
          session.replaceDialog('visitDate');
        }
    });
  });
}
*/

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
  console.log('Authorize this app by visiting this url: ', authUrl);
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
  console.log('I think the date is:', (new Date()).toISOString())
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
  // adjust for timezone offset which is negative
  // so effectively add the offset in minutes to the time to get locale specific time
  //timeMin.setTime(timeMin.getTime() + (-1*timeMin.getTimezoneOffset()*60*1000))
  console.log('timeMin.toISOString is :', timeMin.toISOString())

  timeMax = (new Date(dateOfVisit))
  timeMax.setHours(timeMax.getHours() + 1)
  // add an hour
  //timeMax.setTime(timeMax.getTime() + (1*60*60*1000))
  console.log('timeMax.toISOString is :', timeMax.toISOString())
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


/*
  console.log('session.conversationData.utcDate:', session.conversationData.utcDate)
  console.log('startDate:', session.conversationData.utcDate)
  endDate = session.conversationData.utcDate
  endDate.setHours(endDate.getHours()+1)
  console.log('endDate:', endDate)
*/

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
