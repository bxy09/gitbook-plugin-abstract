/* global require, module */
var fs = require('fs');
var cheerio = require('cheerio');
var format = require('string-template');

module.exports = {
  hooks: {
    page: function(page) {
      'use strict';
      let $ = cheerio.load(page.content);
      $(':contains("进度")').each(function() {
        let sum = 0;
        let done = 0;
        $(this).next().children('li').each(function() {
          sum += 1;
          if ($(this).find('del').length > 0) {
            done += 1;
          }
        });
        if (sum !== done) {
          $(this).append(format(`
            <span id="project-progress" class="red">
              <span id="done">{done}</span> / <span id="sum">{sum}</span>
            </span>`,
            {
              done: done,
              sum: sum
            }));
        }
      });

      page.content = $.html();

      return page;
    },
    'finish:before': function() {
      'use strict';
      try {
        var context = this;
        var progressPath = context.output.resolve('progress/index.html');
        var content = fs.readFileSync(progressPath);
        var $progress = cheerio.load(content);
        var progressContent = $progress('section.normal.markdown-section');
        var progressBlock = cheerio.load(
          `
            <h1 id="项目进度索引">项目进度索引</h1>
            <h2 id="正在进行">正在进行的项目</h2>
            <ul id="working"></ul>
            <h2 id="存档">存档</h2>
            <ul id="expired"></ul>
        `
        );
        var workingOn = progressBlock('ul#working');
        var summaryPath = context.output.resolve('index.html');
        content = fs.readFileSync(summaryPath);
        var $ = cheerio.load(content);

        var expired = {};
        $('.summary :contains("项目列表")').next().children('li').each(function() {
          var a = $(this).children('a').first();
          var name = a.text().trim();
          var href = a.attr('href');
          var path = context.output.resolve(a.attr('href'));
          var content = fs.readFileSync(path);
          var $page = cheerio.load(content);
          var progress = $page('#project-progress');
          if (progress.length === 0) {
            var modPattern = /\d{4}-\d{2}/;
            var matches = modPattern.exec($page('.footer-modification').text());
            var key = '';
            if (matches.length > 0) {
              key = matches[0];
            }
            if (expired[key] === undefined) {
              expired[key] = [];
            }
            expired[key].push(format(
              `<li><a href="../{href}">{name}</a></li>`, {
                href: href,
                name: name
              }));
          } else {
            workingOn.append(format(
              `<li><a href="../{href}">{name}</a>{progress}</li>`, {
                href: href,
                name: name,
                progress: progress.html()
              }));
          }
        });
        const expiredKeys = Object.keys(expired);
        if (expiredKeys.length > 0) {
          const sorted = expiredKeys.sort();
          let expiredBlock = progressBlock('ul#expired');
          for (let i = 0; i < sorted.length; i++) {
            let key = sorted[i];
            expiredBlock.append(format('<h3 id="{key}">{key}</h3>', {
              key: key
            }));
            for (let j = 0; j < expired[key].length; j++) {
              var ele = expired[key][j];
              expiredBlock.append(ele);
            }
          }
        }
        progressContent.prepend(progressBlock.html());
        fs.writeFileSync(progressPath, $progress.html());
      } catch (e) {
        console.error('Failed to generate the progress info');
        console.error(e);
      }
    }
  }
};
