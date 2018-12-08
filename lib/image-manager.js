module.exports.getImageMetaData = getImageMetaData;

const path = require('path');
const pathExists = require('path-exists');
const sizeOf = require('image-size');

function getImageMetaData(imgPath, dataPath) {
    try {
        // check that path exists
        if(pathExists.sync(imgPath)) {

            // check for valid file type
            const regex = RegExp(/.*(jpg|png|jpeg|gif)$/);
            if(!regex.test(imgPath)){
                return(new Error('Invalid file type. Please use: jpg, png, jpeg, or gif.'));
            }

            // separate file name from extension
            const name = imgPath.substring(imgPath.lastIndexOf('/')+1).replace(RegExp(/.(jpg|png|jpeg|gif)$/), '');
            const extension = path.extname(imgPath);
            
            // get the dimensions of the original image
            const dimensions = sizeOf(imgPath);
            const w = dimensions.width;
            const h = dimensions.height;
        
            // return the image metadata
            return {
                name: name,
                src: imgPath,
                extension: extension,
                dataDir: dataPath,
                w,
                h
            };
        } else {
            return new Error('File path does not exist.');
        }
    } catch (error) {
        console.error(error);
        return error;
    }
}