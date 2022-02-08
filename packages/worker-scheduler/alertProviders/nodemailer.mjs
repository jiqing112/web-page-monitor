import * as nm from "nodemailer";
import { CONFIG } from "../CONFIG.mjs";
import { getDB } from "../lib/index.mjs";
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import mjml2html from 'mjml';
import * as Diff from 'diff';

// alertDebounce in milliseconds
let defaultAlertDebounce = 1000 * 60 * 3; // dev 3 minutes
let minAlertDebounce = 1000 * 60 * 2 // dev 2 minutes
if(CONFIG.useProdConfig){
  defaultAlertDebounce = 1000 * 60 * 60 * 6; // 6 hours
  minAlertDebounce = 1000 * 60 * 60 * 1 // 1 hour
}
const __dirname = (() => {let x = path.dirname(decodeURI(new URL(import.meta.url).pathname)); return path.resolve( (process.platform == "win32") ? x.substr(1) : x ); })();
// load mjml basic html structure template
let mjmlTpl = fs.readFileSync( path.resolve(__dirname, 'nodemailer-tpl-mjml.mjml'), 'utf8');
let template = Handlebars.compile(mjmlTpl);

/**
 * 
 * @param {WithId<Document>} prevDoc 
 * @param {WithId<Document>} doc 
 * @param {*} taskDetail 
 */
async function alertFormatter({prevDoc, doc, taskDetail}) {
  console.log('inside alertFormatter');

  let diff = Diff.diffWords(prevDoc.textContent, doc.textContent);
  let diffHTML = "";
  if(diff.length && diff.find(v => (v.added || v.removed))){
    for (let i = 0; i < diff.length; i++) {
      if (diff[i].added && diff[i + 1] && diff[i + 1].removed) {
        let swap = diff[i];
        diff[i] = diff[i + 1];
        diff[i + 1] = swap;
      }
  
      let inner;
      if (diff[i].removed) {
        inner = `<del>${diff[i].value}</del>`
      } else if (diff[i].added) {
        inner = `<ins>${diff[i].value}</ins>`
      } else {
        inner = `<span>${diff[i].value}</span>`
      }
      diffHTML += inner;
    }
  }else{
    diffHTML = `Sorry, the text content on the page is too long to compare. Please check the page manually.<br/>
    抱歉，页面上的文本太长了，无法对比。请手动查看。`;
  }

  let middleTpl = template({diffHTML, taskDetail});

  let htmlDiffContent = mjml2html(middleTpl).html;

  let result = {
    content: `The task ${taskDetail.extra.alias} has Changed, please go to web site monitor to view details.  
任务${taskDetail.extra.alias}有变动，请去网页监控系统查看详细信息。`,
    htmlContent : `${htmlDiffContent}`,
  };
  return result;
}

async function alertSender({content, htmlContent, taskDetail}) {
  // console.log(content);
  // create reusable transporter object using the default SMTP transport
  // https://nodemailer.com/about/
  // https://nodemailer.com/app/
  let transporter = nm.createTransport({
    host: CONFIG.nodemailer.host,
    port: CONFIG.nodemailer.port,
    secure: CONFIG.nodemailer.secure, // true for 465, false for other ports
    auth: CONFIG.nodemailer.auth,
  });

  // send mail with defined transport object
  try {
    let domain = taskDetail.pageURL.replace(/^https?:\/\//,'').replace(/^www\./, '').split('/')[0];
    let info = await transporter.sendMail({
      from: CONFIG.nodemailer.from, // sender address
      to: taskDetail.userInfo.email || "hnnk@qq.com", // list of receivers
      subject: `网页变动通知 Web Page Changes Alert`, // Subject line
      text: content || "Hello world?", // plain text body
      html: htmlContent || content || "<b>Hello world?</b>", // html body
    });
    
    console.log("Message sent: %s", info.messageId);
  } catch (error) {
    console.error(error)
    return {
      err: 'mail send failed',
      success: false,
      prevAlertTime: 0,
    };
  }finally{

  }
  return {
    err: null,
    success: true,
    prevAlertTime: Date.now(),
  }

}

async function exec({prevDoc, doc, taskDetail}) {
  let alertDebounce = defaultAlertDebounce;
  if(taskDetail && taskDetail.extra &&  taskDetail.extra.alertDebounce){
    alertDebounce = parseInt(taskDetail.extra.alertDebounce, 10);
  }
  // defaultAlertDebounce is 6 hours.
  // min alertDebounce is 1 hour.
  if( Number.isNaN(alertDebounce) || alertDebounce < minAlertDebounce){
    alertDebounce = defaultAlertDebounce;
  }
  console.log('inside provider nodemailer exec');
  if(!CONFIG.nodemailer.host) return null;
  // let db = await getDB();
  let { content, htmlContent} = await alertFormatter({prevDoc, doc, taskDetail});
  let alertResult;
  // debounce the alert
  if(taskDetail.tmpCache && taskDetail.tmpCache.prevAlertTime && (Date.now() - taskDetail.tmpCache.prevAlertTime < alertDebounce)){

  }else{
    alertResult = await alertSender({content, htmlContent, taskDetail});
  }
  return alertResult;
}

// TODO find a place to save one task's last notify time
// give ability to save previous notify time


// main().catch(console.error);


let nodemailer = {
  name: 'nodemailer',
  alertFormatter,
  alertSender,
  exec,
}

export { nodemailer, nodemailer as default };