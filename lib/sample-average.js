module.exports.sample = sample;

const fs = require('fs');
const gpx = require('get-pixels');
const sharp = require('sharp');
const cliProgress = require('cli-progress');

function sample(imgMetaData, sizeReduce, pps, callback) {

    // calculate the parameters for the size-reduced image
    let wReduce = Math.floor(imgMetaData.w/sizeReduce);
    let hReduce = Math.floor(imgMetaData.h/sizeReduce);
    let srcReduce = `${imgMetaData.dataDir}/${imgMetaData.name}-reduce${sizeReduce}${imgMetaData.extension}`;
    let dataDir = imgMetaData.dataDir;
    let saveDir = `${dataDir}/${imgMetaData.name}-samples-r${sizeReduce}.json`;

    // resize and save a reduced copy of the image
    resizeImage(wReduce, hReduce, imgMetaData.src, srcReduce)
        .then(() => {
            // create the outline for the final sample object
            constructSampleList(wReduce, hReduce, pps, (err, sampleList) => {
                if(err) {
                    console.error(err);
                } else {
                    // run through the pixel data and calculate the avg r, g, b, and a values
                    calculateSamples(sampleList, wReduce, srcReduce, saveDir, (err, result) => {
                        if(err){
                            return callback(err);
                        } else {
                        return callback(null, result);
                        }
                    });
                }
            })
        })
        .catch((err) => {
            console.error(err);
        });
}

function calculateSamples(sampleList, wReduce, srcReduce, dataDir, callback) {
   console.log('Calculating samples. This may take a while ...');

   // get the pixel data from the reduced image
   gpx(srcReduce, (err, pixels) => {
       if(err) {
         console.error(err);
         return callback(err);
       } else {
         try {
            let pixelData = pixels.data;
            console.log(pixelData);
            // init CLI progress bar:
            const bar = new cliProgress.Bar({clearOnComplete: true}, cliProgress.Presets.shades_classic);
            const numSamples = pixelData.length*sampleList.length;
            bar.start(numSamples, 0);
            let count = 0;
            // assign a sample index (sx, sy) for each pixel*sample combination
            for(let j = 0; j < sampleList.length; j++){
                let pps = sampleList[j].sampleMetaData.pps;
                let nsx = sampleList[j].sampleMetaData.nsx;
                let nsy = sampleList[j].sampleMetaData.nsy;
                let flagRoundXUp = sampleList[j].sampleMetaData.flagRoundXUp;
                let flagRoundYUp = sampleList[j].sampleMetaData.flagRoundYUp;
                let sx = null;
                let sy = null;

                // loop through each pixel in the data set, and make additional calculations on each
                for(let i = 0; i < pixelData.length; i++){
                    let p = Math.floor(i/4)+1; // pixel index (1-indexed)
                    let x = p % wReduce; // x coordinate of image
                    let y = Math.floor(p/wReduce); // y coordinate of image
                    let rgba; // type of pixel data (e.g. r, g, b, a)

                    switch(i%4) {
                        case 0: rgba = "r";
                            break;
                        case 1: rgba = "g";
                            break;
                        case 2: rgba = "b";
                            break;
                        case 3: rgba = "a";
                            break;
                    }

                    if(flagRoundXUp == false && Math.floor(x/pps) == nsx){
                        sx = Math.floor(x/pps)-1;
                    } else {
                        sx = Math.floor(x/pps);
                    }

                    if(flagRoundYUp == false && Math.floor(y/pps) == nsy){
                        sy = Math.floor(y/pps)-1;
                    } else {
                        sy = Math.floor(y/pps);
                    }

                    try {
                        sampleList[j].sampleMatrix[sx][sy][`${rgba}Total`]+=pixelData[i];                        
                    } catch (error) {
                        console.log('error');
                    }
                    sampleList[j].sampleMatrix[sx][sy][`${rgba}Count`]++;

                    // update the CLI progress bar
                    count++;
                    bar.update(count);
                }
            }

            // final processing of sample list
            for(let i = 0; i < sampleList.length; i++) {
                let matrix = sampleList[i].sampleMatrix;
                let placeholder = [];
                for(let j = 0; j < matrix.length; j++) {
                    let col = matrix[j];
                    for(let k = 0; k < col.length; k++){
                        let sample = col[k];
                        try{
                            let finalSample = {
                                'sx': j,
                                'sy': k,
                                'rAvg': sample.rTotal / sample.rCount,
                                'gAvg': sample.gTotal / sample.gCount,
                                'bAvg': sample.bTotal / sample.bCount,
                                'aAvg': sample.aTotal / sample.aCount
                            };
                        placeholder.push(finalSample)
                        } catch(err) {
                            console.error(err);
                            console.log('i', i, 'j', j, 'k', k);
                        }
                    }
                }
                sampleList[i].sampleMatrix = placeholder;
            }

        // stop CLI progress bar, write the file, return the callback and the sample list
        console.log(dataDir.substring(0,dataDir.lastIndexOf('/')+1));
        if (!fs.existsSync(dataDir.substring(0,dataDir.lastIndexOf('/')+1))){
             fs.mkdirSync(dataDir.substring(0,dataDir.lastIndexOf('/')+1));
        }
        fs.writeFileSync(dataDir, JSON.stringify(sampleList));
        bar.stop();
        return callback(null, sampleList);

        // catch all for errors during the sampling process.
        } catch(err) {
            return callback(err);
        }
    }
   });
}

function resizeImage (wReduce, hReduce, src, srcReduce) {
    console.log('Reducing size of image file ...');
    return new Promise ((resolve, reject) => {
        // check if the resized image already exists
        if (fs.existsSync(srcReduce)) {
            resolve();
        } else {
            sharp(src)
            .resize(wReduce, hReduce)
            .toFile(srcReduce, (err) => {
                if(err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        }
    });
}

function constructSampleList (wReduce, hReduce, pps, callback) {
    console.log('Constructing Sample List');

        /* 
        The final constructed object will take the following form
        sampleList = [{
            sampleMetaData: {},
            sampleMatrix: [][]
        }, ...]
        */

        // sampleList will hold an object for each sample set that contains both
        // the sample meta data and the sample matrix:
        let sampleList = [];
    
        try {
            for(let i = 0; i < pps.length; i++) {

                // placeholder for array that will contain one element per sample *set*, specifed by pps
                let sampleMetaData;
        
                // nsx is the number of *whole* samples that will fit along the x-axis
                // given the x dimension of the image and the pps used for sampling
                let nsx = Math.floor(wReduce / pps[i])
        
                // rx is the remainder, i.e. how many pixels are not captured by nsx. If this
                // number is greater than half the pps, create a new sample to hold the remaining values
                let rx = (wReduce / pps[i]) - nsx;
                let flagRoundXUp = false;
                if(rx >= 0.5){
                    nsx++;
                    flagRoundXUp = true;
                }
        
                // repeat the process for the y dimension (remember, samples are squares, so pps is used
                // for both dimensions)
                let nsy = Math.floor(hReduce / pps[i])
                let ry = (hReduce / pps[i]) - nsy;
                let flagRoundYUp = false;
                if(ry >= 0.5){
                    nsy++;
                    flagRoundYUp = true;
                }
        
                // push the parameters for the sample set
                sampleMetaData = {
                    pps: pps[i],
                    nsx: nsx,
                    nsy: nsy,
                    flagRoundYUp,
                    flagRoundXUp
                };

                // placeholder for array that will contain one element per sample *set*, specifed by pps
                let sampleMatrix = [];

                // initialize the sample matrix of dimensions [nsx][nsy]
                for(let j = 0; j < sampleMetaData.nsx; j++){
                    sampleMatrix.push([]);
                    for(let k = 0; k < sampleMetaData.nsy; k++){
                        sampleMatrix[j].push({
                            "rTotal": 0,
                            "gTotal": 0,
                            "bTotal": 0,
                            "aTotal": 0,
                            "rCount": 0,
                            "gCount": 0,
                            "bCount": 0,
                            "aCount": 0
                        });
                    }
                }
        
                sampleList.push({
                    sampleMetaData: sampleMetaData,
                    sampleMatrix: sampleMatrix
                });
            }
            console.log(sampleList);
            return callback(null, sampleList);
        } catch (err) {
            return callback(err);
        }
}