const puppeteer = require('puppeteer');
const {PubSub} = require('@google-cloud/pubsub');


async function getSecondDegreeUrls(u) {
    try {
        console.log('scraping')

        console.log('building browser')
        const browser = await puppeteer.launch({args: ['--no-sandbox']});

        const page = await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });

        console.log('waiting for loading')
        await page.goto(u, {"waitUntil" : "networkidle2", "timeout": 120 * 1000});

        const secondDegreeUrls = await page.evaluate(() => {
            let aTags = document.querySelectorAll('a');

            let allLinks = [];
            aTags.forEach(tag => {
                if (tag.href !== undefined) {
                    allLinks.push(new URL(tag.href, document.location.href).href);
                }
            });

            allLinks.push(document.location.href);

            return [...new Set(allLinks)].sort(() => {Math.random() - Math.random()}).slice(0, 10);
        });
        console.log(secondDegreeUrls);


        return secondDegreeUrls
    } catch (err) {
        console.error(err);
    }
}

exports.secondDegreeUrls = async (req, res) => {
  const url = req.body.url;

  console.log('running');
  console.log(url);

  let urls = await getSecondDegreeUrls(url);
  res.send(JSON.stringify(urls));
};