/* ------------- Application Setup ------------- */

/**
 * Declare Dependencies
 */
var express = require('express');
var request = require('request');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var jsonfile = require('jsonfile');
var mongo = require('mongodb');

// setup mongo client
var MongoClient = mongo.MongoClient;
var url = 'mongodb://localhost:27017/cs411';

var client_id;
var client_secret;
var redirect_uri = 'http://localhost:8888/callback';

/**
 * Get auth keys
 */
var auth = 'auth.json';
jsonfile.readFile(auth, function(err, obj) {
   client_id = obj.client;
   client_secret = obj.secret; 
});

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

/**
 * Setup Express server
 */
var stateKey = 'spotify_auth_state';
var app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname + '/assets'))
   .use(cookieParser());
  app.engine('html', require('ejs').renderFile)
  app.set('view engine', 'ejs');



/* ------------- Application Routing ------------- */

/**
 * Redirects user to Spotify to authenticate
 */
app.get('/login', function(req, res) {

    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    var scope = 'user-read-private user-read-email user-top-read playlist-modify-public playlist-modify-private';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        })
    );
});

/**
 * Logs user out of app
 */
app.get('/logout', function(req, res) {
   res.redirect('/'); 
});

/**
 * Main page that user lands on
 */
app.get('/', function(req, res) {
    res.render('login.html');
});

/**
 * Main screen of app after being logged in
 * If user is no longer logged in, redirect them
 * to the login page
 */
app.get('/dashboard', function(req, res) {

    // User can only access dashboard
    // if an access token has been granted
    var accessToken = req.query.access_token;
    
    if (!accessToken) {
        res.redirect('/');
    } else {        
        var getTopArtistsOptions = {
            url: 'https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=5',
            headers: { 'Authorization': 'Bearer ' + accessToken },
            json: true
        };        
        // Get user's top artists to act as seeds for recommendations
        request.get(getTopArtistsOptions, function(err, artistResponse, body) {
            
            var artistsArr = [];
            
            // push to arr
            for (var artist in body.items) {
                artistsArr.push(body.items[artist].id);
            }
                        
            var artistsStr = artistsArr.join();
            
            //once done, we can get the recommendations
            var playlists = {
                "gym": {
                    url: 'https://api.spotify.com/v1/recommendations?min_energy=0.6&max_instrumentalness=0.0&market=US&seed_artists=' + artistsStr + '&limit=10',
                    headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
                    json: true
                },
                "sleep": {
                    url: 'https://api.spotify.com/v1/recommendations?max_energy=0.2&min_acousticness=0.2&min_instrumentalness=0.2&max_danceability=0.2&market=US&seed_artists=' + artistsStr + '&limit=10',
                    headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
                    json: true
                },
                "lounge": {
                    url: 'https://api.spotify.com/v1/recommendations?max_energy=0.5&min_acousticness=0.1&min_instrumentalness=0.1&max_danceability=0.6&market=US&seed_artists=' + artistsStr + '&limit=10',
                    headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
                    json: true
                },
                "party": {
                    url: 'https://api.spotify.com/v1/recommendations?target_energy=1.0&max_instrumentalness=0.0&target_danceability=1.0&market=US&seed_artists=' + artistsStr + '&limit=10',
                    headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
                    json: true
                },
                "work": {
                    url: 'https://api.spotify.com/v1/recommendations?market=US&max_energy=0.6&min_instrumentalness=0.7&max_danceability=0.6&min_acousticness=0.5&min_valence=0.2&seed_artists=' + artistsStr + '&limit=10',
                    headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
                    json: true
                },
                "random": {
                    url: 'https://api.spotify.com/v1/recommendations?market=US&target_energy=' + Math.random() + '&target_danceability=' + Math.random() + '&seed_artists=' + artistsStr + '&limit=10',
                    headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
                    json: true
                }
            };
            var numPlaylists = 5;
            
            var recommendations = {};
            
            // for each playlist, get some recommendations
            for (let p in playlists) {
                request.get(playlists[p], function(error, response, body) { 
                                        
                    recommendations[p] = [];
                                        
                    // process data into a format that will be displayed
                    // and push to array
                    for (var song in body.tracks) {
                        recommendations[p].push({
                            id: body.tracks[song].id,
                            uri: body.tracks[song].uri,
                            name: body.tracks[song].name,
                            album: body.tracks[song].album.name,
                            artist: body.tracks[song].artists[0].name,
                            albumArt: body.tracks[song].album.images[0].url,
                            previewUrl: body.tracks[song].preview_url
                        });                        
                    } 
                    
                    // only render index.html
                    // once all playlists have been processed
                    // ideally we would use promises, but there
                    // is support for multiple browsers is kinda
                    // sketchy... lookin at u internet explorer
                    numPlaylists--;
                    
                    if (numPlaylists == 0) {
                        
                        var options = {
                            url: 'https://api.spotify.com/v1/me',
                            headers: { 'Authorization': 'Bearer ' + accessToken },
                            json: true
                        };
                        
                        console.log(recommendations['gym']);
                        
                        request.get(options, function(error, response, body) {   
                                                  
                            res.render('index.html', { profile: body, playlists: recommendations, token: accessToken } );                       
                        }); 
                    }                   
                });    
            }
           
        });
        
        // If logged in, get your profile info
/*
        var options = {
            url: 'https://api.spotify.com/v1/me',
            headers: { 'Authorization': 'Bearer ' + accessToken },
            json: true
        };
        
        var gymRec = {
            url: 'https://api.spotify.com/v1/recommendations?market=US&seed_genres=dance,edm,hip-hop,work-out,club&limit=10',
            headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
            json: true
        };
        
        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {            
            res.render('index.html', { profile: body } );                       
        }); 
*/
    }  
});

/*
app.get('/', function(req, res) {
    //token expires in an hour?
    //got this accesstoken from https://developer.spotify.com/web-api/console/get-current-user-saved-tracks/#complete
    var getUserSongs_AccessToken = 'BQAXe_GoUEG9oOkhH-d5iY2pSyFgUTB5ESJLYEEz5EDyCMqmx-mdsc-zaG0aa7SdxFQxKj0bWNmX617KAxaMG0z9XJ8mbynte6k5H8rlTXfhDb4TvyIM1eXC0_8ySQYKH8F6naHd2QEG8FH10KNAubdJ';
    var fetchTracks = {
        url: 'https://api.spotify.com/v1/me/tracks?limit=10',
        headers: {'Authorization' : 'Bearer ' + getUserSongs_AccessToken},
        json: true
    };
    
    request.get(fetchTracks, function(error, response, body) {  
        console.log('DONE',body);      
        res.render('index.html', { data: response.body });
    });    
});
*/

/**
 * Callback after authorizing
 * account with Spotify
 */
app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;
                
        res.redirect('/dashboard?' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
        }));
                
        // we can also pass the token to the browser to make requests from there
        } else {
            res.redirect('/#' +
              querystring.stringify({
                error: 'invalid_token'
            }));
      }
    });
  }
});

app.post('/createPlaylist', function(req, res) {
    
    // first get some profile info
    var accessToken = req.body.accessToken;
    var title = req.body.title;
    var getProfile = {
        url: 'https://api.spotify.com/v1/me',
        headers: { 'Authorization': 'Bearer ' + accessToken },
        json: true
    };
    
    var collaborative = req.body.collaborative;
    var trackListings = req.body.trackListings;
        
    request.get(getProfile, function(error, response, body) {  
        
        // get spotify userid 
        var userID = body.id;
        
        console.log(body);  
        
        // Next, connect to mongo to see if user has an existing
        // playlist. If so, we just want to update the track
        // listing not create a new one
        MongoClient.connect(url, function (error, db) {
            if (error) {
                
            } else {
                var collection = db.collection('userPlaylists');
                var cursor = collection.find({ userID: userID, playlistTitle: title });
                
                cursor.limit(1);
                
                // find the users's data
                cursor.toArray(function(error, result) {
                    if (error) {
                        res.setHeader('Content-Type', 'application/json');
                        res.send(JSON.stringify({ success: false, message: error}));
                        res.end(); 
                    } else {
                        
                        // if the user already has a playlist, just update the tracks
                        // as opposed to creating a new playlist
                        console.log("result:",result);
                        
                        if (result.length > 0) {
                            var playlistID = result[0].playlistID;
                            var updateTracks = {        
                                url: 'https://api.spotify.com/v1/users/' + userID + '/playlists/' + playlistID + '/tracks',
                                headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
                                json: true,
                                body: {
                                    uris: trackListings
                                }
                            }; 
                            
                            console.log('update tracks');
                                                        
                            request.put(updateTracks, function(error, response, body) {
                                                                
                                // The user may have deleted the playlist from their account :/
                                // if so, just add it again
                                if (error || response.statusCode != 201) {
                                    createPlaylist(userID, accessToken, title, collaborative, trackListings, res);
                                } else {
                                    
                                    db.close();
                                    console.log('updated');
                                    res.setHeader('Content-Type', 'application/json');
                                    res.send(JSON.stringify({ success: true, playlistID: playlistID}));
                                    res.end();
                                    
                                }
                            });
                            
                        // otherwise, user has no existing playlist
                        // so go ahead and create a new one
                        } else {   
                            
                            createPlaylist(userID, accessToken, title, collaborative, trackListings, res);
                        }
                    }
                });
            }
        });
                                    
    }); 

    
    // get relevant data;  
/*
    */
});

function createPlaylist(userID, accessToken, title, collaborative, trackListings, res) {
    
    console.log('inplaylist',userID);
    
    // create the playlist first
    var toCreate = {        
        url: 'https://api.spotify.com/v1/users/' + userID + '/playlists',
        headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
        json: true,
        body: {
            name: title,
            public: true,
            collaborative: collaborative
        }
    };  
        
    request.post(toCreate, function(error, response, body) { 
        

        
        // get the ID of the newly created playlist
        var playlistID = body.id; 
        
        // next add tracks to the playlist
        var addTracks = {        
            url: 'https://api.spotify.com/v1/users/' + userID + '/playlists/' + playlistID + '/tracks',
            headers: {'Authorization' : 'Bearer ' + accessToken, 'Accept' : 'application/json'},
            json: true,
            body: {
                uris: trackListings
            }
        };
        if (error) {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ success: false, message: error}));
            res.end();
            
        } else {
                console.log('created');
            request.post(addTracks, function(error, response, body) {
                if (error) {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify({ success: false, message: error}));
                    res.end();
                } else {
                    console.log('tracks added');
                    MongoClient.connect(url, function (error, db) {
                        var collection = db.collection('userPlaylists');
                        
                        // delete any old data if it exists
                        collection.deleteOne( { userID: userID, playlistTitle: title });
                        
                        // now we need to insert a row into the database
                        // so we can update the playlist accordingly in the future
                        collection.insert( { userID: userID, playlistTitle: title, playlistID: playlistID} , function(error, result) {
                            console.log(error,result);
                            //Close connection
                            db.close();
                            if (error) {
                                res.setHeader('Content-Type', 'application/json');
                                res.send(JSON.stringify({ success: false, message: error}));
                                res.end();
                            } else {
                                res.setHeader('Content-Type', 'application/json');
                                res.send(JSON.stringify({ success: true, playlistID: playlistID}));
                                res.end();
                            }
                        });
                    });
                }
            });
        }
                                                                
    }); 
}

/*

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});
*/

console.log('Listening on 8888');
app.listen(8888);