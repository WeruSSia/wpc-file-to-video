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

AWS.config.region = awsConfig.region;
const userPool = new CognitoUserPool({
    UserPoolId:  awsConfig.userPoolId,
    ClientId: awsConfig.clientId,
});

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