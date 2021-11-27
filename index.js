// Require frameworks and instantiate them
const fastify = require('fastify')({ logger: true });
const https = require('https');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const archiver = require('archiver');
var YouTube = require('youtube-node');


// Get depency files
let index = fs.readFileSync("index.html");
let style = fs.readFileSync("style.css");
let liked = fs.readFileSync("images/liked.png");
let unliked = fs.readFileSync("images/unliked.png");
let list = JSON.parse(fs.readFileSync("list.txt"));
console.log(list.length)

var youTube = new YouTube();
youTube.setKey('YOUTUBE API KEY');

// Declaring route
fastify.get('/', async (request, reply) => {
  reply
    .code(200)
    .header('Content-Type', 'text/html; charset=utf-8')
    .send(index)
})

fastify.get('/style', async (request, reply) => {
  reply
    .code(200)
    .header('Content-Type', 'text/css; charset=utf-8')
    .send(style)
})

fastify.get('/liked', async (request, reply) => {
  reply
    .code(200)
    .header('Content-Type', 'images/png; charset=utf-8')
    .send(liked)
})

fastify.get('/unliked', async (request, reply) => {
  reply
    .code(200)
    .header('Content-Type', 'images/png; charset=utf-8')
    .send(unliked)
})

fastify.get('/favicon.ico', async (request, reply) => {
  reply
    .code(200)
    .send({})
})

fastify.get('/list', async (request, reply) => {
  // Get the list of songs
  reply
    .code(200)
    .send({
      success: true,
      songs: JSON.stringify(list)
    })
})

fastify.get('/playlist', async (request, reply) => {
  // Send the zip folder of most liked songs
  if (list.length == 0) return reply.code(200).send("No entry to download");
  let archive = await sync()
  if (archive) {
    console.log("Archive sent")
    let playlist = fs.readFileSync("playlist.zip");
    reply
      .code(200)
      .header('Content-Type', 'application/zip; charset=utf-8')
      .send(playlist)
  }
})

fastify.post('/like', async (request, reply) => {
  // Increment or decrement song's like
  let success = false;
  let q = request.body;
  let value = 0;
  if (q.includes("unlike")) {
    value = -1
    q = q.substring(6)
  }
  if (q.includes("like")) {
    value = 1;
    q = q.substring(4)
  }
  console.log(q)
  for (var i in list) {
    if (q == list[i].id) {
      success = true
      list[i].like += value
      saveList()
    }
  }
  reply
    .code(200)
    .send({
      success: success
    })
})

fastify.post('/songs', async (request, reply) => {
  // Get the list of songs
  let [success, err] = await ytbRequest(request.body);
  reply
    .code(200)
    .send({
      success: success,
      error: err,
      songs: JSON.stringify(list)
    })
})

function ytbRequest(query) {
  return new Promise((resolve, reject) => {
    query = clean(query);
    if (!already(query)) {
      youTube.getById(query, function(error, result) {
        try {
          if (error) {
            console.log(error);
            resolve([false, error])
          }
          else {
            var snip = result.items[0].snippet
            list.splice(0, 0, {
                    id: query,
                    title: snip.title,
                    desc: snip.description,
                    img: snip.thumbnails.default.url,
                    like: 0
                  })
            saveList();
            download(query)
            resolve([true, null]);
          }
        } catch (err) {
          resolve([false, "Please enter a valid url"])
        }
      });
    } else {
      resolve([false, "This song is already added to the list"])
    }
  })
}

async function download(q) {
  ytdl('http://www.youtube.com/watch?v='+q, {filter: 'audioonly'})
  .pipe(fs.createWriteStream('songs/'+q+'.mp3'));
}

function sync() {
  return new Promise((resolve, reject) => {
    delDir("zip/");
    sortedList = [list[0]];
    for (var i = 1; i < list.length; i++) {
      for (var j = 0; j < sortedList.length; j++) {
        if (sortedList[j].like <= list[i].like) {
          sortedList.splice(j, 0, list[i]);
          break;
        }
      }
    }
    for (var k = 0; k < sortedList.length && k < 200; k++) {
      try {
        fs.copyFileSync('songs/'+sortedList[k].id+'.mp3', 'zip/'+sortedList[k].like+'_'+sortedList[k].title+'.mp3');
      } catch (err) {
        console.log("Cannot copy "+sortedList[k].title+'.mp3')
      }
    }
    var output = fs.createWriteStream('playlist.zip');
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    output.on('close', function() {
      console.log('Zip archive created');
      delDir("zip/");
      resolve(true);
    });
    archive.on('error', function(err){
      console.log(err);
    });
    archive.pipe(output);
    archive.directory("zip/", false);
    archive.finalize();
  })
}

function already(q) {
  for (var i in list) {
    if (q == list[i].id) {
      return true
    }
  }
  return false
}

function saveList() {
  fs.writeFileSync('list.txt', JSON.stringify(list));
}

function clean(q) {
  let out = q;
  if (q.includes("=")) {
    out = out.substring(out.indexOf("=")+1)
  }
  if (q.includes("&")) {
    out = out.substring(0, out.indexOf("&"))
  }
  return out
}

function delDir(dir) {
  fs.readdir(dir, (err, files) => {
    if (err) throw err;
    for (const file of files) {
      fs.unlink(path.join(dir, file), err => {
        if (err) throw err;
      });
    }
  });
}

// Run the server!
const start = async () => {
  try {
    await fastify.listen(3000)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
