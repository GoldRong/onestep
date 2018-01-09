const User = require('../models/user')
const Catalogue = require('../models/catalogue')
const jwt = require('jsonwebtoken')
const config = require('../config/config')
const msg = require('./msg')
const axios = require('axios')

const generateToken = function(user) {
  return jwt.sign(user, config.jwtSecret, {expiresIn: config.expiresIn})
}

exports.smsCodeForSignup = (req, res) => {
  const {phoneNum} = req.body

  User.findOne({phoneNum: phoneNum}).then(doc => {
    if (doc) {
      console.log('phoneNum already exists')
      return res.status(403).json({
        errorMsg: 'PHONE_NUM_ALREADY_EXISTS',
        success: false,
      })
    } else {
      msg.send(req, res)
    }
  })
}

exports.wechat = function(req, res, next) {
  const {code, userAgent} = req.body
  let wxToken
  if (userAgent === 'PC') {
    wxToken = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${
      config.weChatAppId
    }&secret=${
      config.weChatAppSecret
    }&code=${code}&grant_type=authorization_code`
  } else {
    wxToken = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${
      config.serviceAppID
    }&secret=${
      config.serviceAppSecret
    }&code=${code}&grant_type=authorization_code`
  }

  axios.get(wxToken).then(req => {
    if (req.data.errcode) return
    const {access_token, openid} = req.data
    const wxUserInfo = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`

    axios.get(wxUserInfo).then(req => {
      if (req.data.errcode) return
      User.findOne({'bindings.unionid': req.data.unionid})
        .exec()
        .then(user => {
          //已经绑定
          if (user) {
            res.status(200).json({
              token: generateToken({
                _id: user._id,
                phoneNum: user.phoneNum
              }),
              user: {phoneNum: user.phoneNum},
              binding: true,
            })
          } else {
            res.status(200).json({user: req.data, binding: false})
          }
        })
    })
  })
}

exports.binding = (req, res, next) => {
  const {phoneNum, password, old} = req.body
  const {nickname, headimgurl, unionid} = req.body.user
  if (old) {
    User.findOne({phoneNum})
      .exec()
      .then(user => {
        user.bindings.push({nickname, headimgurl, unionid})
        return user.save().then(user => {
          res.status(200).json({
            user: {phoneNum: user.phoneNum},
            token: generateToken({_id: user._id, phoneNum: user.phoneNum}),
          })
        })
      })
      .catch(err => {
        console.log(err)
      })
  } else {
    const user = new User()
    user.phoneNum = phoneNum
    user.password = password
    user.bindings = [{via: 'wechat', nickname, headimgurl, unionid}]
    user
      .save()
      .then(user => {
        res.status(200).json({
          user: {phoneNum: user.phoneNum},
          token: generateToken({_id: user._id, phoneNum: user.phoneNum}),
        })
      })
      .catch(err => {
        console.log(err)
      })
  }
}

exports.signup = (req, res, next) => {
  const {password, phoneNum, smsCode} = req.body

  User.findOne({phoneNum: phoneNum}).then(doc => {
    if (doc) {
      return res.status(403).json({
        errorMsg: 'PHONE_NUM_ALREADY_EXISTS',
        success: false,
      })
    }
  })

  msg
    .check(phoneNum, smsCode)
    .then(msg => {
      console.log('smsCode: ' + msg)
      User.findOne({phoneNum: phoneNum})
        .then(doc => {
          if (doc) {
            console.log('phoneNum already exists')
            return res.status(403).json({
              errorMsg: 'PHONE_NUM_ALREADY_EXISTS',
              success: false,
            })
          }

          const user = new User()
          user.phoneNum = phoneNum
          user.password = password

          user.save().then(user => {
            console.log(phoneNum + 'signup')
            return res.status(200).json({
              user: {phoneNum: user.phoneNum},
              token: generateToken({phoneNum: user.phoneNum}),
              success: true,
            })
          })
        })
        .catch(next)
    })
    .catch(err => {
      console.log(err)
      return res.status(403).json({
        errorMsg: err,
        success: false,
      })
    })
}

exports.login = (req, res, next) => {
  const {username, password, phoneNum, smsCode} = req.body

  if (username) {
    // 老用户过渡
    msg
      .check(phoneNum, smsCode)
      .then(msg => {
        console.log('smsCode: ' + msg)
        User.findOne({username: username})
          .then(user => {
            if (!user) {
              console.log("the user doesn't exist")
              return res.status(403).json({
                errorMsg: 'USER_DOESNOT_EXIST',
                success: false,
              })
            } else {
              if (user.phoneNum) {
                console.log('该用户已绑定手机号' + user.phoneNum)
                return res.status(403).json({
                  errorMsg: 'PLEASE_USE_PHONE_NUM',
                  success: false,
                })
              }
              // update
              user.phoneNum = phoneNum
              user.password = password

              user
                .save()
                .then(user => {
                  console.log(username + ' updated: ' + phoneNum)
                  return res.status(200).json({
                    user: {phoneNum: user.phoneNum},
                    token: generateToken({phoneNum: user.phoneNum}),
                    success: true,
                  })
                })
                .catch(err => {
                  console.log(err)
                })
            }
          })
          .catch(next)
      })
      .catch(err => {
        console.log(err)
        return res.status(403).json({
          errorMsg: err,
          success: false,
        })
      })
  } else {
    // 手机号登录
    User.findOne({phoneNum: phoneNum})
      .then(user => {
        if (!user) {
          console.log("this phoneNum doesn't exist")
          return res.status(403).json({
            errorMsg: 'PHONE_NUM_DOESNOT_EXIST',
            success: false,
          })
        } else {
          user.comparePassword(password, function(err, isMatch) {
            if (err) {
              return console.log(err)
            }
            if (!isMatch) {
              console.log('invalid password')
              return res.status(403).json({
                errorMsg: 'INVALID_PASSWORD',
                success: false,
              })
            }
            console.log(phoneNum + 'login')
            return res.json({
              user: {phoneNum: user.phoneNum},
              token: generateToken({phoneNum: user.phoneNum}),
              success: true,
            })
          })
        }
      })
      .catch(next)
  }
}

exports.checkToken = function(req, res) {
  const token = req.body.token
  if (token) {
    jwt.verify(token, config.jwtSecret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            errorMsg: 'EXPIRED_TOKEN',
            success: false,
          })
        } else {
          return res.status(401).json({
            errorMsg: 'INVALID_TOKEN',
            success: false,
          })
        }
      } else {
        if (decoded.phoneNum) {
          req.phoneNum = decoded.phoneNum
          return res.status(200).json({
            message: 'VALID_TOKEN',
            success: true,
          })
        } else {
          return res.status(401).json({
            errorMsg: 'INVALID_TOKEN',
            success: false,
          })
        }
      }
    })
  } else {
    return res.status(403).json({
      errorMsg: 'TOKEN_NOT_FOUND',
      success: false,
    })
  }
}

const chooseExpireDate = function(allExpireDateArr) {
  let parsedDate = []
  allExpireDateArr.forEach(date => {
    parsedDate = [...parsedDate, Date.parse(date)]
  })
  const maxParsedDate = Math.max(...parsedDate)
  let d = new Date()
  d.setTime(maxParsedDate)
  let latestExpireDate = JSON.stringify(d).substr(1, 10)

  return latestExpireDate
}

// Profile Page API
// 用于展示 profile 页的课程卡片
function getPaidCourse(course) {
  return Catalogue.findOne({link: `/${course}`})
    .then(item => {
      return item
    })
    .catch(err => {
      console.log(err)
    })
}

// 遍历获取每个...
async function getEveryPaidCourses(courses) {
  if (Object.prototype.toString.call(courses) !== '[object Array]') {
    throw new Error('courses must be an array')
  }

  let paidCourses = []
  for (let course of courses) {
    let a = await getPaidCourse(course)

    paidCourses.push(a)
  }

  return paidCourses
}

// API
exports.profile = (req, res) => {
  const {phoneNum} = req.body
  let courses = []
  let total = 0
  let allExpireDateArr = []
  let paidCourses = []

  User.findOne({phoneNum: phoneNum})
    .populate('contracts')
    .then(async user => {
      if (!user) {
        console.log('user is ' + user)
        return res.status(403).json({
          errorMsg: 'USER_DOESNOT_EXIST',
          success: false,
        })
        // throw new Error('user is ' + user)
      }
      const {admin} = user

      const contracts = user.contracts
      // 区别处理每个订单
      for (let contract of contracts) {
        // all paid courses
        courses = [...courses, ...contract.courseId]
        // 获取已购买课程的信息
        paidCourses = await getEveryPaidCourses(courses)

        // total
        total += contract.total

        // collect all kinds of membership expireDate
        if (contract.type === 'vip' || contract.type === 'member') {
          allExpireDateArr = [...allExpireDateArr, contract.expireDate]
        }
      }

      let latestExpireDate =
        allExpireDateArr.length !== 0
          ? chooseExpireDate(allExpireDateArr)
          : null

      return res.json({
        paidCourses,
        total,
        latestExpireDate,
        admin,
      })
    })
    .catch(error => {
      console.log(error)
    })
}

// reset password
exports.resetPassword = (req, res, next) => {
  const {password, phoneNum, smsCode} = req.body
  msg
    .check(phoneNum, smsCode)
    .then(msg => {
      console.log('smsCode: ' + msg)
      User.findOne({phoneNum: phoneNum}).then(user => {
        // update password
        user.password = password

        user.save().then(user => {
          console.log(phoneNum + ' reset password')
          return res.status(200).json({
            user: {phoneNum: user.phoneNum},
            token: generateToken({phoneNum: user.phoneNum}),
            success: true,
          })
        })
      })
    })
    .catch(err => {
      console.log(err)
      return res.status(403).json({
        errorMsg: err,
        success: false,
      })
    })
}