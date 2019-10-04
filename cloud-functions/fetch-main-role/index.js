const {Storage} = require('@google-cloud/storage');
const puppeteer = require('puppeteer');
const archiver = require('archiver');
const url = require('url');
const fs = require('fs-extra');

async function autoScroll(page){
  await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
          var totalHeight = 0;
          var distance = 100;
          var timer = setInterval(() => {
              var scrollHeight = document.body.scrollHeight;
              window.scrollBy(0, distance);
              totalHeight += distance;

              if(totalHeight >= scrollHeight){
                  clearInterval(timer);
                  resolve();
              }

              if (totalHeight / distance >= 100) {
                  clearInterval(timer);
                  resolve();
              }
          }, 400);


          setTimeout(function () {
            window.scroll({
                            top: 0,
                            left: 0,
                            behavior: 'smooth'
                        });
    
            document.body.scrollTop = document.documentElement.scrollTop = 0;
    
            }, 15);
      });
  });
}

async function saveScreenshot(u) {
    console.log('saving screenshot')
    var dirPath = '/tmp/' + (url.parse(u).hostname + '-' + Date.now().toString()).replace(/\./g,'_');

    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath);
    }

    try {
        console.log('scraping')

        console.log('building browser')
        const browser = await puppeteer.launch({args: ['--no-sandbox']});

        const page = await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });

        console.log('waiting for loading')
        await page.goto(u, {"waitUntil" : "networkidle2", "timeout": 0});

        console.log('checking for main role');
        if (await page.$('main, [role="main"]') === null) {
            console.log('found no main landmark');
            return;
        } else {
            console.log('found main landmark');
        }

        console.log('scrolling');
        await autoScroll(page);

        console.log('getting bbox of main landmark');
        const mainElementBbox = await page.evaluate(() => JSON.stringify(document.querySelector('main, [role="main"]').getBoundingClientRect()));
        const scrollInfo = await page.evaluate(() => JSON.stringify({'windowX': window.scrollX, 'windowY': window.scrollY}));
        const metaData = JSON.stringify({
          bbox: mainElementBbox,
          scrollInfo,
          url: u
        });
        fs.writeFileSync(dirPath + '/metadata.json', metaData);

        console.log('taking visual screenshot of whole web page');
        await page.screenshot({ path: dirPath + '/screenshot.jpg', type: 'jpeg', fullPage: true, quality: 25 });

        console.log('closing browser');
        await browser.close();

        console.log('zipping');
        var fileName = dirPath + '.zip'
        var fileOutput = fs.createWriteStream(fileName); 

        var archive = archiver('zip');

        fileOutput.on('close', function () {
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
        });

        await archive.pipe(fileOutput);
        await archive.glob(dirPath + "/**/*");

        archive.on('error', function(err){
            throw err;
        });
        await archive.finalize();

        console.log('uploading to gcs bucket');

        var storage = new Storage({
            projectId: 'icon-classifier',
        })

        var bucket = storage.bucket('main-role-scraped');

        console.log(fileName)

        await bucket.upload(fileName)
        .then(data => console.log('done'))
        .catch(err => console.log(err));
        
        console.log('removing local files');
        fs.unlinkSync(fileName);
        fs.removeSync(dirPath)
    } catch (err) {
        console.error(err);
    }
}

exports.screenshotPubSubScale = async (pubSubEvent, context) => {
  const url = Buffer.from(pubSubEvent.data, 'base64').toString();

  console.log('running');
  console.log(url);

  await saveScreenshot(url);
  console.log('finished');
};