const jwt = require('jsonwebtoken')
const User = require('./../models/user')
const axios = require('axios')
const crypto = require('crypto')
const constants = require('./../config/constants')
const jsonfile = require('jsonfile')

const inconsistentUsersPath = __dirname + '/inconsistentUsers.json'


module.exports.createToken = async function(req, res){
    try{
        //Fetch access_token from github
        const requestToken = req.query.code
        const ghTokenResponse = await axios({
            method: 'post',
            url: `${constants.githubAuthURL}?client_id=${constants.githubClientID}&client_secret=${constants.githubClientSecret}&code=${requestToken}`,
            headers: {
                accept: 'application/json'
            }  
        })
        //Check for permission scopes
        const scope = ghTokenResponse.data.scope.split(",")
        if (!scope.includes('read:org') || !scope.includes('user:email')){
            return res.status(401).json({
                message: 'More permissions are required'
            })
        }

        //Fetch user email from github
        const ghUserEmailResponse = await axios({
            method: 'get',
            url: `${constants.githubAPIDomain}/user/emails`,
            headers: {
                accept: 'application/vnd.github.v3+json',
                Authorization: `token ${ghTokenResponse.data.access_token}`
            }  
        })

        //Check if the user exists in our db
        let user = await User.findOne({email: ghUserEmailResponse.data[0].email})
        if(!user){
            //Create a new user if the user does not exist in our db
            const newUser = {
                'email': ghUserEmailResponse.data[0].email
            }
            //Fetch user info from github
            const ghUserResponse = await axios({
                method: 'get',
                url: `${constants.githubAPIDomain}/user`,
                headers: {
                    accept: 'application/vnd.github.v3+json',
                    Authorization: `token ${ghTokenResponse.data.access_token}`
                }  
            })
            newUser['name'] = ghUserResponse.data.name || ghUserResponse.data.login
            newUser['username'] = ghUserResponse.data.login
            newUser['avatarUrl'] = ghUserResponse.data.avatar_url

            /*
                In order to handle a case when user tries signing in gets created on RC but fails get stored in our db due to some error
                To keep it consistent with RC we store the (user-email,encrypted-rcPassword) pair in our fs so that it can be used
                to store later in our db
            */
            let inconsistentUsers = jsonfile.readFileSync(inconsistentUsersPath)
            let rcPassword = inconsistentUsers[newUser.email]
            
            if(rcPassword){
                //If the user already exists on RC
                delete inconsistentUsers[newUser.email]
                jsonfile.writeFileSync(inconsistentUsersPath, inconsistentUsers)
            } else {
                //Generate RC password and create user on RC
                rcPassword = Math.random().toString(36).slice(2) +  Math.random().toString(36).toUpperCase().slice(2)
                await axios({
                    method: 'post',
                    url: `${constants.rocketChatAPIURL}/users.register`,
                    headers: {
                        'Content-type': 'application/json'
                    },
                    data: `{
                        "name": "${newUser.name}",
                        "email": "${newUser.username}@rc4git.com",
                        "pass": "${rcPassword}",
                        "username": "${newUser.username}_rc4git"
                    }`
                })
                //Encrypt RC password
                const cipher = crypto.createCipheriv(constants.algorithm, constants.key, constants.iv.toString('hex').slice(0, 16))
                rcPassword = cipher.update(rcPassword, 'utf8', 'hex') + cipher.final('hex')
            }
            
            newUser['rcPassword'] = rcPassword
            
            try{
                //Store user in our db
                user = await User.create(newUser)
            } catch(err) {
                inconsistentUsers[newUser.email] = rcPassword
                jsonfile.writeFileSync(inconsistentUsersPath, inconsistentUsers)
                throw err
            }
        }
        //Decrypt RC Password to login on RC and genearte rc_uid and rc_token
        const decipher = crypto.createDecipheriv(constants.algorithm, constants.key, constants.iv.toString('hex').slice(0, 16))
        const rcLoginUserResponse = await axios({
            method: 'post',
            url: `${constants.rocketChatAPIURL}/login`,
            headers: {
                'Content-type': 'application/json'
            },
            data: `{
                "password": "${decipher.update(user.rcPassword, 'hex', 'utf8') + decipher.final('utf8')}",
                "user": "${user.username}_rc4git"
            }`
        })
        
        //Set cookies with rc_token, rc_uid and rc4git_jwt_token
        res.cookie('rc_token', rcLoginUserResponse.data.data.authToken)
        res.cookie('rc_uid', rcLoginUserResponse.data.data.userId)
        res.cookie('rc4git_token', jwt.sign(user.toJSON(), 'rc4git'))

        return res.status(200).json({
            message: "Success"
        })
    } catch(err) {
        return res.status(500).json({
            message: 'Internal Server Error'
        })
    }
}