
import { LitElement, html, css, nothing } from "lit";
import { RichText } from '@atproto/api';

class BskyComments extends LitElement {
  static properties = {
    url: {},
    data: { attribute: false },
    error: { attribute: false },
  };
  static styles = css`
    :host {
      display: block;
    }
  `;
  async connectedCallback () {
    super.connectedCallback();
    console.warn(`URL:`, this.url, atURL(this.url));
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?${new URLSearchParams({ uri: atURL(this.url) }).toString()}`,
      {
        method: 'GET',
        headers: { "Accept": "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      this.error = `Failed to fetch post thread: ${await res.text()}`;
      return;
    }
    this.data = await res.json();
  }
  render() {
    let content = html`<p>loading…</p>`;
    if (this.error) content = html`<p>${this.error}</p>`
    else if (this.data?.thread) {
      content = html`<bsky-post .post=${this.data.thread}></bsky-post>`;
      console.log(this.data.thread);
    }
    return html`<div>
      ${content}
    </div>`;
  }
}
customElements.define("bsky-comments", BskyComments);

// post
//  ~~uri: at-uri
//  ~~author
//    did
//    ~~handle
//    ~~displayName
//    ~~avatar: url
//  ~~record
//    ~~createdAt
//    ~~facets (use lib for this)
//    ~~text
//  embed
//    external []
//      uri
//      title
//      description
//      thumb: url
//    images []
//      thumb uri
//      fullsize url
//      alt
//      aspectRatio
//        height
//        width
//  replyCount
//  repostCount
//  likeCount
//  quoteCount
// ~replies: [posts]
class BskyPost extends LitElement {
  static properties = {
    post: { attribute: false },
  };
  static styles = css`
    :host {
      display: block;
    }
    .content {
      display: flex;
      gap: 1rem;
    }
    .avatar {
      max-width: 42px;
    }
    .avatar img {
      border-radius: 21px;
    }
    .rich-text {
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }
    .replies {
      margin-top: 1rem;
      padding-left: 0.5rem;
      border-left: 1px solid #ccc;
    }
    .meta {
      color: rgb(66, 87, 108);
    }
    .meta strong {
      color: #000;
    }
    .meta a {
      color: inherit;
      text-decoration: none;
    }
  `;
  render () {
    if (!this.post) return html`<div>loading post…</div>`;
    const { post: { uri, author, record, embed, replyCount, repostCount, likeCount, quoteCount }, replies = [] } = this.post;
    const rid = uri.replace(/.+\//, '');
    const rt = new RichText(record);
    const textContent = [];
    for (const seg of rt.segments()) {
      if (seg.isLink()) textContent.push(html`<a href=${seg.link?.uri}>${sane(seg.text)}</a>`);
      else if (seg.isMention()) textContent.push(html`<a href=${`https://bsky.app/profile/${seg.mention?.did}`}>${sane(seg.text)}</a>`);
      else if (seg.isTag()) textContent.push(html`<a href=${`https://bsky.app/hashtag/${seg.tag?.tag}`}>${sane(seg.text)}</a>`);
      else textContent.push(sane(seg.text));
    }
    return html`<div class="post">
      <div class="content">
        <div class="avatar"><img alt=${author.displayName || author.handle} src=${author.avatar} width="42" height="42"></div>
        <div class="body">
          <div class="meta">
            ${ author.displayName ? html`<strong>${author.displayName}</strong>` : nothing }
            ${ author.handle }
            •
            <a href=${`https://bsky.app/profile/${author.handle}/post/${rid}`}><time datetime=${record.createdAt}>${formatDate(record.createdAt)}</time></a>
          </div>
          <div class="rich-text">${textContent}</div>
        </div>
      </div>
      <div class="replies">
        ${replies.map(r => html`<bsky-post .post=${r}></bsky-post>`)}
      </div>
    </div>`
  }
}
customElements.define("bsky-post", BskyPost);


// --- Helpers
function atURL (url) {
  if (!url.startsWith('at://') && url.includes('bsky.app/profile/')) {
    const match = url.match(/profile\/([\w.]+)\/post\/([\w]+)/);
    if (match) {
      const [, did, postId] = match;
      return `at://${did}/app.bsky.feed.post/${postId}`;
    }
  }
  return url;
}

function formatDate (str) {
  let [day, time] = str.split('T');
  time = time.replace(/\:\d\d\..+/, '');
  return `${day} ${time}`;
}

function sane (str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}
