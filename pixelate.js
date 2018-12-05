module.exports = pixelate;

const sampleAverage = require('./lib/sample-average.js');
const imageManager = require('./lib/image-manager.js');

/**
 * Converts an image into a set of samples with values reflecting the average
 * RGB values for each of a set of square sample with dimensions specified by
 * the pps parameter(s) (pixels-per-sample)
 * 
 * @param {string} imagePath - Path to the image file (.jpg, .jpeg, .png,
 *     or .gif are valid)
 * @param {string} dataDirectory - Path to a folder that will contain the
 *     final sample output
 * @param {string} sizeReduce - The magnitude by which to reduce the image
 *     size prior to sampling. A higher value will result in fewer samples
 *     but will reduce the runtime of the sampling process
 * @param {number[]} pps - Specifies the width and height of each square
 *     sample of area pps^2. Muliple pps values can be listed in the array,
 *     which will result in one sample set per pps value. Lower pps values
 *     result in higher sample sizes.
 */

function pixelate (imagePath, dataDirectory, sizeReduce, pps) {
    const imgMetaData = imageManager.getImageMetaData(imagePath, dataDirectory);
    sampleAverage.sample(imgMetaData, sizeReduce, pps, (err, result) => {
        if(err) {
            console.error(err);
        } else {
            console.log(result);
        }
    });
}