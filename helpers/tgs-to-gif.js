// From https://github.com/ed-asriyan/tgs-to-gif

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const renderLottie = require('puppeteer-lottie');
const tempy = require('tempy');
const zlib = require('zlib');

const unzip = function(inputStream, outputPath) {
    const outputStream = fs.createWriteStream(outputPath);
    return new Promise((resolve, reject) =>
        inputStream
            .pipe(zlib.createGunzip())
            .pipe(outputStream)
            .on('finish', err => (err ? reject(err) : resolve()))
    );
};

const convertFile = async function(fileStream, outputPath) {
    const browser = await puppeteer.launch();

    const unzippedPath = tempy.file({ extension: 'json' });
    await unzip(fileStream, unzippedPath);

    await renderLottie({
        path: unzippedPath,
        output: outputPath,
        browser
    });
    await browser.close();
};

module.exports = convertFile;
