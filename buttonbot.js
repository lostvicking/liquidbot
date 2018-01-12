var builder = require('botbuilder');
var restify = require('restify');

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

//var bot = new builder.UniversalBot(connector, [
//    function (session) {
//        session.beginDialog('welcomeDialog')
//    }
//]);
var bot = new builder.UniversalBot(connector, function (session) {
    session.send("Hi... I am here to assist with booking visits to the Liquid Sutdio in Stockholm.");
    session.beginDialog('welcomeDialog')
});


// use args param to send welcome message to user
bot.dialog('welcomeDialog', function (session) {
    var msg = new builder.Message(session);
    msg.attachments([
       new builder.HeroCard(session)
           .text("Would you like to book a visit to the Studio?")
           .buttons([
               builder.CardAction.imBack(session, "bookVisit", "yes"),
               builder.CardAction.imBack(session, "don't book visit", "no")
           ])
       ]);

    session.send(msg).endDialog();
});

bot.dialog('bookVisit', [
    function (session, args, next) {
        console.log('Aha!!!!!!!!!!!!!!1')
    }
]).triggerAction({ matches: 'bookVisit' });
