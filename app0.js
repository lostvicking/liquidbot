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
            input: {'text': session.message.text}
        },  function(err, response) {
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
          console.log('Message text is: ' + session.message.text, '---------------------', JSON.stringify(response, null, 2), '---------------------');

      // intent detection
      if (response.intents.length > 0 && response.intents[0].intent === 'RequestStudioVisit') {
          watsonContext = response.context
          datePrompt = response.output.text[0]
          console.log('We are returning the following tings', response.context, response.output.text[0])
          session.conversationData.watsonContext = response.context
          console.log('persisted watson context as:', session.conversationData.watsonContext)
          //session.endDialogWithResult({
          //  response: { context: response.context, prompt: response.output.text[0] }
          //});
          session.beginDialog('pickDate')

      }
  })
})
.triggerAction({
    matches: /^I want to visit Liquid Studio$/i,
});

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

/*
bot.dialog('pickOwnDate', function (session, args, next) {
  builder.Prompts.time(session, 'What date do you have mind?');
  session.dialogData.time = builder.EntityRecognizer.resolveTime([results.response]);
  session.endDialog()
})
.triggerAction({
    matches: /^pick my own date$/i,
});
*/

/*
bot.dialog('gatherStudioVisitInfo', [
    function(session, args, next) {
        console.log('gatherStudioVisitInfo args', args)
        session.beginDialog('visitDate')
    },
    function(session, results) {
        session.beginDialog('numberOfVisitors')
    }
])
*/

// go through the Dialog as configured on IBM Watson
bot.dialog('visitDate', [
    function (session, args, next) {
        // this should ask for the date
        builder.Prompts.time(session, 'What date and time do you have mind (format: mm-dd-yyyy hh:MM, eg: 03-25-2018 15:30)?');

    },
    // now we have the date, confirm it?
    function (session, results, next) {
        console.log('date is:', results);
        dateOfVisit = results.response.resolution.start;
        builder.Prompts.confirm(session, 'Please confirm the date is ' + dateFormat(dateOfVisit, 'mm-dd-yyyy hh:MM'))
        dateOfVisit = dateFormat(dateOfVisit, 'mm-dd-yyyy hh:MM')
    },function (session, results, next) {
        if (results.response) {
          session.conversationData.watsonContext.date = dateFormat(dateOfVisit, 'mm-dd-yyyy')
          session.conversationData.watsonContext.time =  dateFormat(dateOfVisit, 'hh:MM')
          console.log('session.conversationData.watsonContext', session.conversationData.watsonContext)
            // send confirmed response to IBM
            conversation.message({
                input: {
                    'text': 'I want to visit Liquid Studio'
                    //'date': dateFormat(dateOfVisit, 'mm-dd-yyyy'),
                    //'time': dateFormat(dateOfVisit, 'hh:MM')
                },
                context: session.conversationData.watsonContext
            },  function(err, response) {
                if (err) {
                    console.log('error:', err);
                } else {
                    session.conversationData.watsonContext = response.context
                    session.conversationData.dateOfVisit = dateOfVisit
                    console.log(JSON.stringify(response, null, 2));
                    console.log('date of visit set for : ', session.conversationData.dateOfVisit)
                    //session.endDialogWithResult( {response : dateOfVisit})
                }
            })
        } else {
            console.log('go and get the date again');
            session.replaceDialog('visitDate');
        }
        console.log('we\'ve emerged out of the if')
        next()
    },function (session, results, next) {
      session.beginDialog('numberOfVisitors')
    }
]).triggerAction({
    matches: /^pick my own date and time$/i,
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
          conversation.message({
              input: {
                  'number': ""+numberOfVisitors
              },
              context: session.conversationData.watsonContext
          },  function(err, response) {
              if (err) {
                  console.log('error:', err);
              } else {
                  session.conversationData.watsonContext = response.context
                  session.conversationData.numberOfVisitors = numberOfVisitors
                  console.log(JSON.stringify(response, null, 2));
                  console.log('size of party is  : ', session.conversationData.numberOfVisitors)
                  //session.endDialogWithResult( {response : dateOfVisit})
              }
          })
        } else {
            console.log('go and get the number of the people again');
            session.replaceDialog('numberOfVisitors');
        }
    }
])
