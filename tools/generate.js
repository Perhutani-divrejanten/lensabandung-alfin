const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

const SHEETS_URL = process.env.SHEETS_URL || 'https://script.google.com/macros/s/AKfycbwxSv8HmShXP5nng9NTAVgnDgGtfzNCXh8liAgsUWjtTcvRC9KrXpr-ioWLGmultck0fw/exec';

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const ARTICLES_JSON_PATH = path.resolve(__dirname, '../articles.json');
const OUT_DIR = path.resolve(__dirname, '../article');
const IMG_DIR = 'img';

function toSlug(str) {
  if (!str) return 'unknown';
  return str.toString().trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function backupArticlesJson() {
  const timestamp = Math.floor(Date.now() / 1000);
  const backupPath = `${ARTICLES_JSON_PATH}.bak.${timestamp}`;
  if (fs.existsSync(ARTICLES_JSON_PATH)) {
    fs.copyFileSync(ARTICLES_JSON_PATH, backupPath);
    console.log(`✅ Backup: ${path.basename(backupPath)}`);
  }
}

function readExistingArticles() {
  try {
    if (fs.existsSync(ARTICLES_JSON_PATH)) {
      return JSON.parse(fs.readFileSync(ARTICLES_JSON_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('⚠️  Error reading articles.json:', e.message);
  }
  return [];
}

async function generateArticles() {
  try {
    console.log('📥 Fetching articles from Sheets...');
    const resp = await axios.get(SHEETS_URL, { timeout: 10000 });
    const newArticles = resp.data;
    
    if (!Array.isArray(newArticles) || newArticles.length === 0) {
      console.warn('⚠️  No articles found.');
      return;
    }
    console.log(`📊 Found ${newArticles.length} articles.`);

    if (!fs.existsSync(TEMPLATE_PATH)) {
      console.error(`❌ Template not found: ${TEMPLATE_PATH}`);
      process.exit(1);
    }
    const template = Handlebars.compile(fs.readFileSync(TEMPLATE_PATH, 'utf8'));

    if (!fs.existsSync(OUT_DIR)) {
      fs.mkdirSync(OUT_DIR, { recursive: true });
    }

    let existingArticles = readExistingArticles();
    console.log(`📖 Found ${existingArticles.length} existing articles.`);
    
    backupArticlesJson();

    let newCount = 0, updateCount = 0, skipCount = 0;

    for (const row of newArticles) {
      try {
        const slug = row.slug ? toSlug(row.slug) : toSlug(row.title);
        if (!slug || slug === 'unknown') {
          console.warn(`⏭️  Skip: ${row.title}`);
          skipCount++;
          continue;
        }

        let imagePath = row.image && !row.image.startsWith('http') 
          ? `${IMG_DIR}/${row.image}` 
          : (row.image || '');
        let imagePathForHTML = imagePath && !imagePath.startsWith('http')
          ? `../${imagePath}`
          : imagePath;

        let content = row.content || row.excerpt || '<p>No content</p>';
        if (content && !content.includes('<')) {
          content = `<p>${content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        }

        const articleData = {
          title: row.title || 'Untitled',
          date: row.date || new Date().toISOString().split('T')[0],
          category: row.category || row.badge || 'News',
          badge: row.badge || row.category || 'News',
          image: imagePathForHTML,
          content,
          author: row.author || '',
          excerpt: row.excerpt || content.replace(/<[^>]*>/g, '').substring(0, 150),
          slug
        };

        const html = template(articleData);
        fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), html, 'utf8');

        const jsonEntry = {
          title: articleData.title,
          excerpt: articleData.excerpt.replace(/<[^>]*>/g, '').substring(0, 150),
          category: articleData.category,
          date: articleData.date,
          image: imagePath,
          url: `article/${slug}.html`,
          slug
        };
        if (articleData.author) jsonEntry.author = articleData.author;

        const idx = existingArticles.findIndex(a => a.slug === slug);
        if (idx !== -1) {
          existingArticles[idx] = jsonEntry;
          console.log(`🔄 Update: ${slug}`);
          updateCount++;
        } else {
          existingArticles.unshift(jsonEntry);
          console.log(`✅ New: ${slug}`);
          newCount++;
        }
      } catch (err) {
        console.error(`❌ Error (${row?.title}):`, err.message);
      }
    }

    // DELETE ARTICLES NOT IN SHEET
    const sheetSlugs = new Set(newArticles.map(r => (r.slug ? toSlug(r.slug) : toSlug(r.title))).filter(s => s && s !== 'unknown'));
    const removed = existingArticles.filter(a => !sheetSlugs.has(a.slug));
    if (removed.length) {
      console.log(`🗑️  Deleting ${removed.length} articles (not in sheet):`);
      removed.forEach(a => {
        console.log(`   - ${a.slug}`);
        const f = path.join(OUT_DIR, `${a.slug}.html`);
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
          console.log(`     deleted`);
        }
      });
      existingArticles = existingArticles.filter(a => sheetSlugs.has(a.slug));
    }

    fs.writeFileSync(ARTICLES_JSON_PATH, JSON.stringify(existingArticles, null, 2), 'utf8');
    console.log(`💾 Updated ${ARTICLES_JSON_PATH}`);

    console.log(`\n📋 Summary:`);
    console.log(`   ✨ New: ${newCount}`);
    console.log(`   🔄 Updated: ${updateCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   🗑️  Deleted: ${removed.length}`);
    console.log(`   📁 Total: ${existingArticles.length}`);
    console.log(`\n✅ Done!`);
  } catch (err) {
    console.error('❌ Fatal:', err.message);
    if (err.response?.data) console.error('Response:', err.response.data);
    process.exit(1);
  }
}

generateArticles();
