var
  argv        = require('yargs')                                  //Better agrument handling
    .demand('port')                                               //require a port argument
    .demand('redisconfig')                                        //require a redis config file
    .argv,
  bodyParser  = require('body-parser'),                           //Allow for parsing of POST requests
  express     = require('express'),                               //Our server framework
  hyalineHash = require('hyalinehash'),                           //Use Redis Hashes like they were local variables
  redis       = require('redis'),                                 //Redis module

  redisConfig = require(argv.redisconfig),                        //parse the JSON object set in the arguments. It should be a node_redis configuration object

  client      = redis.createClient(redisConfig),                  //connection to do "normal" redis stuff (HGET/HSET/DEL/...)
  subClient   = redis.createClient(redisConfig),                  //Pub/Sub connection

  app         = express(),                                        //Express framework
  topStories;                                                     //Our local variable that is synced with Redis

function genericErrors() {                                        //Minimalistic (ha!) error handling.
  console.log('error',arguments);
}

topStories = hyalineHash(client, subClient, 'top-stories', true); //sync the topStories variable with the 'top-stories' hash in Redis. The last argument means that we always want the whole hash
topStories.errors.on('any',genericErrors);                        //Setting our error handler up - errors are emitted
topStories.pull();                                                //do an inital sync from Redis

app.set('view engine', 'pug');                                    //Tell Express' res.render to use pug
app.get('/',function(req,res){                                    //The homepage
  res.render('news', topStories);                                 //Rendered with the template using the topStories synced variable
});
app.get('/news-edit',function(req,res){                           //Our editing page - nothing is protected here so anyone can edit this page (read: don't do this in production - add some sort of auth)
  res.render('news-edit', topStories);                            //Again, provide topStories synced variable
});
app.post('/news-edit',                                            //This is the news editing route that actually saves the data. 
  bodyParser.urlencoded({ extended : true }),                     //URL encoding is the standard way to handle form post data, `extended` just means it will be any data type. Since we're casting everything to a string, it doesn't matter
  function(req,res){
    topStories.replaceWith(req.body);                             //We can't do something like `topStories = req.body` as that would make topStories a non-synced variable. We can use `replaceWith` to sub-in all the fields from the passed object.
    res.render('news-edit', req.body);                            //Eventual consistency alert! Since replaceWith probably still sending the data to the Redis server, we can't yet use topStories. Lucikly, req.body will be the same values.
  }
);

app.listen(argv.port,function() {                                 //Start the server
  console.log('Listening at',argv.port);                          //Log to the console that we're ready and where
});