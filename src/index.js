import {hello} from './greet'
import {awsConfig} from './aws_exports'
import {
    CognitoUserPool,
    CognitoUserAttribute,
    CognitoUser,
    AuthenticationDetails,
} from 'amazon-cognito-identity-js';
import AWS from 'aws-sdk';
import {
    CognitoIdentityCredentials
} from 'aws-sdk';
import S3 from 'aws-sdk/clients/s3';
import {v4 as uuidv4 } from 'uuid';

AWS.config.region = awsConfig.region;
const userPool = new CognitoUserPool({
    UserPoolId:  awsConfig.userPoolId,
    ClientId: awsConfig.clientId,
});

//Animation order
const photos = [];
const orderAnimation = (orderAnimationRequest) => {
    getAccessToken()
        .then(token => {
            fetch(
                `${awsConfig.apiBaseUrl}/orders`, 
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    },
                    body: JSON.stringify(orderAnimationRequest)
                }
            ).then(response => console.log(response.json()));
        })
}
const addToOrder = (key) => {
    photos.push(key);
    console.log('current photos list:')
    console.log(photos);
    return key;
}

//Authorization
const register = (registerRequest) => {
    return new Promise((resolve, reject) => {
        const attributeList = [
            new CognitoUserAttribute({
                Name: 'website',
                Value: registerRequest.website,
            })
        ];

        userPool.signUp(
            registerRequest.email, 
            registerRequest.password, 
            attributeList, 
            null, 
            (err, result) => {
                if(err){
                    reject(err);
                }
                resolve(result);
            }
        );
    });
}

const confirmAccount = (confirmRequest) => {
    return new Promise((resolve, reject) => {
        const user = new CognitoUser({
            Username: confirmRequest.email,
            Pool: userPool,
        });
        user.confirmRegistration(confirmRequest.code, true, (err, result) => {
            if(err){
                reject(err);
            }
            resolve(result);
        })
    })
}

const login = (loginRequest) => {
    return new Promise((resolve, reject) => {
        const authDetails = new AuthenticationDetails({
            Username: loginRequest.email,
            Password: loginRequest.password,
        });
    
        const user = new CognitoUser({
            Username: loginRequest.email,
            Pool: userPool
        });
    
        user.authenticateUser(authDetails, {
            onSuccess: (result) => {
                resolve(result);
            },
            onFailure: (err) => {
                reject(err);
            }
        });
    })
}

const refreshAWSCredentials = (tokenData) => {
    AWS.config.credentials = new CognitoIdentityCredentials({
        IdentityPoolId: awsConfig.identityPoolId,
        Logins: {
            [awsConfig.credentialsLoginKey]: tokenData.getIdToken().getJwtToken()
        }
    });
}

const getCurrentUser = () => {
    return new Promise((resolve, reject) => {
        const user = userPool.getCurrentUser();
        if(user==null){
            reject("User not available");
        }
        user.getSession((err,session) => {
            if(err){
                reject(err);
            }
            user.getUserAttributes((err, attributes) => {
                if(err){
                    reject(err);
                }
                const profile = attributes.reduce((profile, item) => {
                    return {...profile, [item.Name]: item.Value}
                }, {});
                resolve(profile);
            });
        })
    })
}

const getAccessToken = () => {
    return new Promise((resolve, reject) => {
        const user = userPool.getCurrentUser();
        if(user==null){
            reject("User not available");
        }
        user.getSession((err,session) => {
            if(err){
                reject(err);
            }
            resolve(session.getIdToken().getJwtToken());
        })
    })
}

const loadLocalStorageCredentials = () => {
    return new Promise((resolve, reject) => {
        const user = userPool.getCurrentUser();
        if(user==null){
            reject("User not available");
        }
        user.getSession((err,session) => {
            if(err){
                reject(err);
            }
            resolve(session);
        })
    })
}

//Storage
const listFiles = () => {
    const s3 = new S3();
    return new Promise((resolve, reject) => {
        s3.listObjectsV2({
            Bucket: awsConfig.bucketName,
            MaxKeys: 10,
        }, (err, data) => {
            if(err){
                reject(err);
            }
            resolve(data.Contents.map(item => {
                return {
                    name: item.Key, 
                    size: item.Size
                }
            }));
        });
    });
}

const uploadToS3 = (userId, file, onProgressChange) => {
    console.log(file);
    return new Promise((resolve, reject) => {
        const key = `uek-krakow/${userId}/${uuidv4()}/${file.name}`;
        const params = {
            Body: file,
            Bucket: awsConfig.bucketName,
            Key: key,
        }
        const s3 = new S3();
        s3.putObject(params, (err, data) => {
            if(err){
                reject(err);
            }
            resolve(key);
        }).on('httpUploadProgress', (progress) => {
            const currentProgress = Math.round((progress.loaded / progress.total)*100);
            onProgressChange(currentProgress);
        });     
    });
}

// HTML DOM manipulations

const getPreviewUrl = (key) => {
    const params = {
        Bucket: awsConfig.bucketName,
        Key: key
    }
    const s3 = new S3();
    return s3.getSignedUrl('getObject', params);
}

const createHtmlElFromString = (strTemplate) => {
    const parent = document.createElement('div');
    parent.innerHTML = strTemplate.trim();

    return parent.firstChild;
}

const addToPreviewList = (url) => {
    const template = `<li><img src="${url}" height="200"/></li>`;
    const el = createHtmlElFromString(template);
    const photosPreviewList = document.querySelector('.photosPreview');
    photosPreviewList.appendChild(el);
}

const clearUploadState = (inputElement, progressBarElement) => {
    progressBarElement.style.width = '0%';
    progressBarElement.textContent = '0%';
    inputElement.value = "";
}

const registerBtn = document.querySelector('.registerAction');
const registerRequestPayload = {
    email: "vha85216@cuoly.com",
    password: "1234qwer",
    website: "test.pl"
}
registerBtn.addEventListener('click', () => {
    register(registerRequestPayload)
        .then(result => console.log(result))
        .catch(err => console.log(err))
});

const confirmAccountBtn = document.querySelector('button.confirmAccount');
const confirmAccountRequest = {
    code: '360092',
    email: registerRequestPayload.email,
};
confirmAccountBtn.addEventListener('click', () => {
    confirmAccount(confirmAccountRequest)
        .then(result => console.log(result))
        .catch(err => console.log(err))
});

const loginBtn = document.querySelector('button.login');
const loginRequestPayload = {
    email: registerRequestPayload.email,
    password: registerRequestPayload.password,
};
loginBtn.addEventListener('click', () => {
    login(loginRequestPayload)
        .then(result => refreshAWSCredentials(result))
        .catch(err => console.log(err))
});

const listFilesBtn = document.querySelector('button.listFiles');
listFilesBtn.addEventListener('click', () =>{
    listFiles()
        .then(fileList => console.log(fileList))
        .catch(err => console.log(err))
    ;
});

const uploadBtn = document.querySelector('div.upload .uploadButton');
uploadBtn.addEventListener('click', () => {
    const filesInput = document.querySelector('div.upload .uploadInput');
    const toBeUploadedFiles = [...filesInput.files];
    const progressBarElement = document.querySelector('div.upload .uploadProgressBar')
    if(toBeUploadedFiles.length==0){
        console.log("No files selected");
        return;
    }
    const userId = AWS.config.credentials.identityId;
    toBeUploadedFiles.forEach((file, index) => {
        uploadToS3(userId, file, (currentProgress) => {
            progressBarElement.style.width = `${currentProgress}%`;
            progressBarElement.textContent = `Uploading... ${currentProgress}%`;
        })
            .then(key => addToOrder(key))
            .then(key => getPreviewUrl(key))
            .then(url => addToPreviewList(url))
            .then(() => clearUploadState(filesInput, progressBarElement))
            .catch(err => console.log(err))
        ;
    });
});

const orderBtn = document.querySelector('button.orderAnimation');
orderBtn.addEventListener('click', () => {
    orderAnimation({
        email: registerRequestPayload.email,
        photos: [...photos]
    });
});

(()=>{
    getCurrentUser()
        .then(profile => hello(`${profile.email}, nice website: ${profile.website}`))
        .catch(err => hello('Guest'))
    ;
    loadLocalStorageCredentials()
        .then(session => refreshAWSCredentials(session))
        .catch(err => console.log(err))
    ;
})();