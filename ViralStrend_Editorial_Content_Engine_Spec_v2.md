# ViralStrend — Editorial Content Engine
## Simplified Technical Specification

**Project:** ViralStrend.com  
**Backend / Admin:** FilamentPHP  
**Purpose:** Build a lightweight content-generation system that produces strong, natural, publication-ready English articles while keeping API usage and implementation complexity under control.

---

# 1. Main Objective

ViralStrend publishes English content focused on:

- Viral stories
- Weird and unexpected stories
- Internet culture
- Digital culture
- Social behavior
- Funny or unusual observations
- Trending topics
- Curious stories with strong shareability

The website already has **three editorial writers**.

Each writer has:

- Name
- Profile image
- Personality
- Tone
- Writing style
- Humor style
- Assigned categories
- Predefined article titles/topics

The existing writer prompts should remain the foundation of the system.

The objective is NOT to create a generic article generator.

The objective is to make one automated request produce an article that feels like it was written by the selected ViralStrend writer.

---

# 2. Keep the Architecture Simple

The first version should NOT use multiple AI agents or multiple article-generation requests.

Avoid:

```text
Research request
↓
Writer request
↓
Editor request
↓
SEO request
↓
Image request
```

Instead use:

```text
FilamentPHP
     ↓
ONE CONTENT GENERATION REQUEST
     ↓
Final structured JSON
     ↓
Save to database
```

The single request should internally instruct the model to perform the following logical steps:

```text
1. Understand the article brief
2. Research / verify information when needed
3. Identify the strongest story angle
4. Write the article in the selected writer's voice
5. Perform a silent editorial review
6. Produce SEO metadata
7. Produce two image concepts
8. Return structured JSON
```

These are logical stages inside one request, not separate API calls.

---

# 3. Article Input

Each article should be stored in an article queue.

Example:

```json
{
  "id": 1024,
  "writer": "alex_carter",
  "category": "Digital Culture",
  "title": "We Spend Way Too Much Time Thinking About How One Text Message Sounds",
  "topic": "Why people sometimes type messages, delete them, rewrite them and worry about how they will be interpreted.",
  "editorial_direction": "Explore the strange social rules of texting, punctuation, response times, emojis and reading too much into short messages.",
  "status": "pending"
}
```

The title is already selected by the editorial team.

The content system should NOT automatically replace good existing titles simply because it can generate another one.

The supplied title is the starting point.

Only change the title when it is:

- Factually inaccurate
- Misleading
- Clearly unclear
- Significantly weaker than the actual story
- Impossible to support with the available information

---

# 4. Writer Profiles

Writer information should be stored separately from the article.

Example:

```json
{
  "id": "alex_carter",
  "name": "Alex Carter",
  "personality": [
    "curious",
    "sharp",
    "observant",
    "confident",
    "conversational"
  ],
  "tone": "slightly witty and conversational",
  "humor_style": "dry, observational, subtle",
  "writing_goal": "Make readers think: That's interesting. I didn't know that.",
  "categories": [
    "Digital Culture",
    "Internet Culture",
    "Social Behavior"
  ],
  "avoid": [
    "academic tone",
    "corporate language",
    "forced jokes",
    "generic introductions",
    "SEO stuffing"
  ]
}
```

The other two writers should follow the same structure.

The content-generation request receives the selected writer's complete profile.

---

# 5. Research and Current Information

The content-generation system should be able to use web research when the subject requires current or verifiable information.

Research should be used particularly for:

- Recent news
- Current events
- Recent developments
- Current products or services
- Recent statistics
- Current public statements
- Events that happened recently
- Claims that require verification

For evergreen topics, research can be used when it materially improves accuracy or adds useful context.

The system should not perform unnecessary searches for every simple evergreen article if doing so does not improve the result.

---

# 6. Research Principles

Before writing, the system should understand:

- What actually happened
- When it happened
- Who is involved
- What is confirmed
- What is reported
- What is only a claim
- What is speculation
- Why people are interested
- What useful context exists
- What unusual or overlooked details exist

Never invent:

- Quotes
- Statistics
- Dates
- Events
- People
- Sources
- Research findings
- URLs

If information cannot be verified, either leave it out or clearly qualify it.

Accuracy is more important than making the story more dramatic.

---

# 7. Find the Strongest Story Angle

The system should not simply summarize research.

Before writing, internally determine:

```text
What is actually interesting about this story?

Why would a reader care?

What is unexpected?

What is strange?

What is relatable?

What is funny?

What detail would make someone stop scrolling?

What might make someone share this with a friend?
```

Choose the strongest angle.

Do not try to use every discovered detail.

Possible angles:

- Unexpected
- Strange
- Funny
- Relatable
- Emotional
- Curious
- Surprising
- Visually interesting
- Something people suddenly noticed
- A small detail with a larger explanation

---

# 8. Writer Instructions

The writer should write as the selected ViralStrend writer.

The writer should NOT sound like:

- An academic paper
- A corporate press release
- An SEO article
- A generic AI-generated blog post

The writing should be:

- Natural
- Fluid
- Conversational
- Intelligent
- Relaxed
- Engaging
- Professionally edited

Use natural contractions such as:

- it's
- don't
- can't
- you'll
- that's

Vary:

- Sentence length
- Paragraph length
- Rhythm
- Word choice

Do not intentionally introduce mistakes to appear human.

---

# 9. Strong Opening

The first paragraph must earn the reader's attention.

Prefer:

- A surprising fact
- An unusual detail
- A strange situation
- A relatable observation
- A contradiction
- A recent development
- An interesting question

Avoid generic openings such as:

```text
In today's rapidly changing world...

In the ever-evolving digital landscape...

In this article, we will explore...

Let's dive into...
```

Internal quality test:

> Would someone who knows nothing about this topic want to read the next paragraph?

---

# 10. Storytelling

Do not produce:

```text
Fact
Fact
Fact
Fact
Conclusion
```

The article should have momentum.

A possible flow is:

```text
Hook
↓
Interesting observation
↓
What happened / what is happening
↓
Unexpected detail
↓
Explanation
↓
Example or context
↓
Why people care
↓
Writer observation
↓
Natural ending
```

This is NOT a fixed template.

The structure should change according to the story.

Do not force every article to use identical headings or sections.

---

# 11. Writer Personality

The writer's personality should appear naturally.

For Alex Carter, for example:

- Curious
- Sharp
- Observant
- Confident
- Conversational
- Slightly witty
- Naturally skeptical when appropriate

The writer can occasionally make a small personal observation.

Examples of the style:

```text
That's probably the strangest part of the whole story.

At first, this sounds like a small detail. It isn't.

The funny thing is, most people probably never noticed it.
```

These are style examples only.

Do not copy them repeatedly.

The writer should have personality without becoming the main character.

---

# 12. Humor

Humor should be:

- Subtle
- Observational
- Dry
- Playful
- Slightly cheeky
- Self-aware when appropriate

Do not force jokes.

Do not put jokes into serious subjects.

Do not use childish humor.

Do not overuse internet slang.

Do not make every paragraph funny.

Principle:

> One genuinely good observation is better than five forced jokes.

---

# 13. Editorial Side Comment

When appropriate, the writer can include one short editorial side comment.

Preferred maximum:

**1**

Absolute maximum:

**2**

HTML:

```html
<div class="editor-note">
<p>💬 Short witty observation</p>
</div>
```

The comment must be:

- Short
- Relevant
- Original
- Natural
- Slightly witty
- In the writer's voice
- Non-promotional

Do not use the same comment repeatedly across articles.

---

# 14. Article Length

Do NOT force a fixed word count.

Do NOT instruct:

```text
Write exactly 1500 words.
```

Instead:

```text
Write enough to fully develop the story.

Do not expand the article merely to reach a word count.

A naturally short story can be concise.
A complex story can be longer.

Every paragraph must earn its place.
```

Remove:

- Repetition
- Empty statements
- Generic observations
- Artificial transitions
- Keyword stuffing
- Sentences written only to increase length

---

# 15. SEO

SEO should be natural and invisible to the reader.

Use:

- Main topic
- Relevant terminology
- Related concepts
- Natural headings
- Meta title
- Meta description
- Focus keyword
- Secondary keywords

Do NOT:

- Stuff keywords
- Repeat the main keyword unnaturally
- Create headings solely for SEO
- Write awkward search-engine sentences
- Add unnecessary sections

Write for humans first.

---

# 16. Silent Self-Editorial Review

Before returning the final result, the model should silently review its own article.

Check:

### Hook
- Is the opening strong?

### Story
- Is there a clear angle?
- Does the article move forward?
- Does every paragraph add something?

### Writing
- Is the English natural?
- Are sentences varied?
- Are paragraphs readable?

### Personality
- Does the selected writer's voice appear?

### Humor
- Is humor natural?
- Is anything forced?

### Accuracy
- Are factual claims supported?
- Are quotes genuine?
- Are uncertain claims qualified?

### SEO
- Is optimization natural?

### Ending
- Does the article end naturally?
- Does it avoid a generic conclusion?

### AI-like patterns
Remove or rewrite:

- Generic introductions
- Repetitive phrasing
- Mechanical transitions
- Repeated conclusions
- Unnecessary headings
- Filler
- Artificially formal language

The model should revise weak sections before returning the final article.

---

# 17. Images

Each article should have exactly **two image concepts**.

## Image 1 — Cover / Featured Image

Used as:

- Article cover
- Homepage/card image
- Main article image

It should represent the central idea of the article.

## Image 2 — In-Article Image

Inserted approximately in the middle of the article.

It should add visual context or represent an important aspect of the story.

The content request should return:

```json
{
  "images": {
    "cover": {
      "prompt": "...",
      "alt": "...",
      "caption": "..."
    },
    "inline": {
      "prompt": "...",
      "alt": "...",
      "caption": "..."
    }
  }
}
```

The image prompts should be based on the actual final article.

Do not generate random images just to satisfy the requirement.

---

# 18. Image Accuracy

Images must not misleadingly present an invented scene as genuine documentary evidence.

For real events:

- Prefer appropriate real/licensed/source imagery when available.
- If an illustration is generated, it should function as an illustration rather than falsely appearing to be a genuine photograph of the event.

For general cultural topics, illustrative images are appropriate.

---

# 19. HTML Output

The article should be returned as clean article-body HTML.

Example:

```html
<h1>Article headline</h1>

<p>Introduction...</p>

<p>...</p>

<h2>Natural section heading</h2>

<p>...</p>

<div class="editor-note">
<p>💬 Editorial observation...</p>
</div>

<p>...</p>
```

Rules:

- Exactly one `<h1>`
- `<h2>` only when genuinely useful
- `<h3>` only when necessary
- `<p>` for paragraphs
- `<strong>` / `<em>` when useful
- `<blockquote>` for genuine quotations
- `<ul>` / `<ol>` only when useful
- `<a>` for relevant sources
- No Markdown
- No Markdown code fences
- No JavaScript
- No unnecessary CSS
- No fake URLs
- No fake quotations

The backend will control the final page design.

---

# 20. Source Information

When web research is used, return the relevant sources in structured form.

Example:

```json
{
  "sources": [
    {
      "title": "Source title",
      "url": "https://example.com",
      "publisher": "Example"
    }
  ]
}
```

Only include sources actually used or relevant to factual claims.

Do not invent URLs.

---

# 21. Final JSON

The single content-generation request should return a structured response similar to:

```json
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "category": "...",

  "article_html": "...",

  "seo": {
    "meta_title": "...",
    "meta_description": "...",
    "focus_keyword": "...",
    "keywords": []
  },

  "images": {
    "cover": {
      "prompt": "...",
      "alt": "...",
      "caption": "..."
    },
    "inline": {
      "prompt": "...",
      "alt": "...",
      "caption": "..."
    }
  },

  "sources": [
    {
      "title": "...",
      "url": "...",
      "publisher": "..."
    }
  ]
}
```

The programmer should enforce JSON/schema validation.

If the response cannot be parsed correctly, retry the request rather than saving incomplete content.

---

# 22. FilamentPHP Integration

The system should be designed around FilamentPHP.

Suggested article fields:

```text
id
writer_id
category_id
title
topic
editorial_direction
slug
excerpt
article_html
meta_title
meta_description
focus_keyword
keywords
cover_image
inline_image
cover_image_prompt
inline_image_prompt
sources
status
created_at
updated_at
```

Suggested statuses:

```text
pending
processing
ready
published
failed
```

The first version should save generated content as:

**Ready / Draft**

so the administrator can inspect it before publishing.

---

# 23. Simple Filament Workflow

The intended user experience:

```text
Admin opens Filament
        ↓
Creates/selects article
        ↓
Selects writer
        ↓
Selects category
        ↓
Adds title
        ↓
Adds topic / editorial direction
        ↓
Clicks "Generate Article"
        ↓
One content-generation request
        ↓
JSON returned
        ↓
Article fields populated
        ↓
Images prompts populated
        ↓
Sources populated
        ↓
Admin reviews
        ↓
Save / publish
```

No complicated multi-agent interface is required.

---

# 24. API Cost Philosophy

The system should prioritize:

- One content-generation request per article
- No unnecessary repeated calls
- No separate editor request
- No separate SEO request
- No separate research request
- No separate image-planning request

The article request should be comprehensive enough to perform all logical tasks internally.

If a request fails technically, the backend may retry.

Do not retry automatically simply because the article is subjectively imperfect unless a later version specifically adds that functionality.

---

# 25. What Should NOT Be Automated in Version 1

Do not overbuild the first version.

Avoid initially:

- Multiple AI agents
- Complex scoring dashboards
- Automatic article rewriting loops
- Automatic publishing without review
- Complex editorial workflows
- Large analytics systems
- Multiple research calls per article
- Complicated queues

First prove that one well-designed request can consistently produce strong articles.

---

# 26. Development Plan

### Phase 1

Build only:

```text
Filament article queue
+
Writer profiles
+
One content-generation request
+
Structured JSON
+
Database storage
```

### Phase 2

Add:

```text
Web research
+
Sources
+
Image prompts
```

### Phase 3

Add:

```text
Image generation/upload
+
Automatic placement
```

### Phase 4

Add:

```text
More writers
+
More categories
+
Scheduling
+
Publishing workflow
```

---

# 27. First Test

Do not immediately generate hundreds of articles.

Use approximately 3–5 existing titles from Alex Carter.

Evaluate:

- Does the article sound like Alex?
- Is the opening strong?
- Is the story interesting?
- Does it provide genuine editorial value?
- Is the humor natural?
- Is the article too long?
- Is there filler?
- Does the structure vary naturally?
- Are factual claims supported?
- Are the two image concepts useful?
- Is the HTML clean?
- Is the JSON reliable?

Only after the output is consistently good should the same engine be connected to the other writers.

---

# 28. Core Principle

The entire system can be summarized as:

```text
Existing Editorial Idea
        ↓
Writer Personality
        ↓
Smart Research When Needed
        ↓
Strong Story Angle
        ↓
One High-Quality Article Request
        ↓
Silent Self-Editing
        ↓
Final Article + SEO + 2 Images + Sources
        ↓
FilamentPHP
```

The most important principle for development is:

> **Keep the architecture simple, but make the single generation prompt intelligent.**

The goal is not a complicated AI pipeline.

The goal is a lightweight system that consistently produces articles that feel like genuine ViralStrend editorial content.
