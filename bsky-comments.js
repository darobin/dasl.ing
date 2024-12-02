
import { LitElement, html, css } from "lit";

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
//  uri: at-uri
//  author
//    did
//    handle
//    displayName
//    avatar: url
//  record
//    createdAt
//    facets (use lib for this)
//    text
//  embed
//    external
//      uri
//      title
//      description
//      thumb: url
//  replyCount
//  repostCount
//  likeCount
//  quoteCount
// replies: [posts]
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
  `;
  render () {
    if (!this.post) return html`<div>loading post…</div>`;
    const { post: { author, record, embed, replyCount, repostCount, likeCount, quoteCount }, replies = [] } = this.post;
    return html`<div class="post">
      <div class="content">
        <div class="avatar"><img alt=${author.displayName || author.handle} src=${author.avatar} width="42" height="42"></div>
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
