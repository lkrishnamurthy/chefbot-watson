/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson conversation
var ToneAnalyzer = require('watson-developer-cloud/tone-analyzer/v3'); // watson tone analyzer
var input_tone = '';
var Promise = require('bluebird');


var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  // url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: Conversation.VERSION_DATE_2016_07_11
});

var tone_analyzer = new ToneAnalyzer({
  username: 'e70ec6bd-f5fb-4f7e-b483-d6182d921b8c',
  password: 'GLdRQXeFDV0O',
  version_date: '2016-05-19'
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  var tone_input = req.body.input
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };


  // Call Tone - StandAlone
  /*tone_analyzer.tone({ text: payload.input.text}, function(err, tone) {
    if (err) {
      console.log(err);
    } else {
      var tones = tone.document_tone.tone_categories[0].tones
      for (var i=0;i<tones.length;i++){
        tone = tones[i]
        if (tone.score == 1){
          input_tone = tone.tone_name
          console.log(input_tone)
        }
      }
    }
  });*/

 // Invoke Tone and Conversation
 invokeToneAsync(payload,tone_analyzer).then(function(tones){
   var tone_categories = tones.document_tone.tone_categories[0].tones
   for (var i=0;i<tone_categories.length;i++){
     var tone = tone_categories[i]
     if (tone.score == 1){
       input_tone = tone.tone_name
     }
   }
    payload.context.user_tone = input_tone
    console.log(payload.context)
  // Send the input to the conversation service along with tone in the context
  conversation.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
 });
});

/**
* Invokes Tone Asynchronously to get tones from input
* @param {Object} payload The request payload
* @param {Obkect} tone_analyzer Analyze handle
*/
 function invokeToneAsync(payload, tone_analyzer) {
   if (!payload.input || !payload.input.text || payload.input.text.trim() == '')
     payload.input.text = '<empty>';
   return new Promise(function(resolve, reject) {
     tone_analyzer.tone({
       text: payload.input.text
     }, (error, data) => {
       if (error) {
         reject(error);
       } else {
         resolve(data);
       }
     });
   });
 }

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  if (!response.output) {
    response.output = {};
  } else {
    return response;
  }
  if (response.intents && response.intents[0]) {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent . In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if (intent.confidence >= 0.75) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if (intent.confidence >= 0.5) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  response.output.text = responseText;
  return response;
}

module.exports = app;
