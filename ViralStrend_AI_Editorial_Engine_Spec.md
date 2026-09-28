# ViralStrend — AI Editorial Content Engine
## Technical & Editorial Specification for Discussion with the Programmer

**Project:** ViralStrend.com  
**Purpose:** Build a simple automated content-production system using the ChatGPT API, while preserving the site's editorial identity and producing publication-ready articles.

---

# 1. Project Goal

ViralStrend is an English-language website focused on:

- Viral stories
- Weird and unexpected stories
- Internet culture
- Digital culture
- Social behavior
- Funny or unusual observations
- Trending topics
- Stories with curiosity, relatability, surprise, or humor

The objective of the content system is **not simply to generate large amounts of AI text**.

The objective is to produce articles that feel like they were written by a small editorial team with distinct writers, personalities, categories, and voices.

The website already has three fictional/editorial writers. Each writer has:

- Name
- Image
- Personality
- Writing style
- Tone
- Humor style
- Assigned categories
- A predefined list of article titles/topics

Example writer:

**Alex Carter**

Alex is:
- Curious
- Sharp-minded
- Observant
- Confident
- Conversational
- Slightly witty
- Naturally skeptical when necessary
- Interested in unusual details

The existing Alex prompt should be used as the foundation rather than discarded.

---

# 2. Existing Editorial Philosophy

The existing Alex Carter prompt already establishes several important principles:

- The writer is not an academic researcher.
- The writer is not an SEO content generator.
- The writer should find the interesting angle of a story.
- The writing should be natural and conversational.
- The article should have personality.
- Humor should be subtle and natural.
- The article should not contain filler.
- Facts, quotes, statistics, and events must not be invented.
- The article should not copy source wording.
- SEO should be natural and invisible to the reader.
- The article should not be artificially extended to reach a word count.
- The article should have a strong opening and a natural ending.
- HTML should be clean and suitable for WordPress.

The existing prompt also requires a final editorial pass before publication.

---

# 3. Important Concept

Do NOT build the system as:

Title → ChatGPT → Article → Publish

Instead, build it as an editorial pipeline:

Title
↓
Writer Profile
↓
Research / Source Information
↓
Story Angle
↓
AI Writer
↓
AI Editor
↓
Quality Gate
↓
Image Planner
↓
SEO Metadata
↓
WordPress Draft

This separation is important because each stage has a different responsibility.

---

# 4. Article Queue

The system should have an article queue.

Each article can contain:

```json
{
  "id": 1024,
  "writer": "alex_carter",
  "category": "digital_culture",
  "title": "We Spend Way Too Much Time Thinking About How One Text Message Sounds",
  "topic": "Why people sometimes type messages, delete them, rewrite them and worry about how they will be interpreted.",
  "editorial_direction": "Explore the strange social rules of texting, punctuation, response times, emojis and reading too much into short messages.",
  "status": "pending"
}
```

Possible statuses:

```text
pending
researching
writing
editing
images
ready
published
failed
```

This makes the process recoverable if an API call fails.

---

# 5. Writer Profiles

The programmer should store each writer separately.

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

The same structure should be used for Writer 2 and Writer 3.

The writer profile should be injected into the Writer Prompt dynamically.

---

# 6. Research Stage

The Research stage should be separate from article writing.

The research process should collect, where relevant:

- Key facts
- Dates
- Relevant background
- Interesting details
- Recent developments
- Useful statistics
- Genuine statements or reactions
- Primary sources
- Reliable secondary sources
- Context
- The reason the story became interesting

The system must distinguish between:

- Confirmed facts
- Reported information
- Claims
- Opinions
- Speculation

Never invent:

- Quotes
- Statistics
- Events
- Dates
- People
- Sources
- URLs
- Research findings

If a claim cannot be verified, it should either be excluded or clearly qualified.

---

# 7. Research Output

The research stage should ideally return structured JSON.

Example:

```json
{
  "research": {
    "core_story": "...",
    "confirmed_facts": [],
    "important_context": [],
    "interesting_details": [],
    "statistics": [],
    "quotes": [],
    "sources": []
  }
}
```

The Writer receives this research package instead of being expected to independently invent factual details.

---

# 8. Story Angle

Before writing, the system should identify the strongest editorial angle.

Ask:

- What is actually interesting about this story?
- What is unexpected?
- What is strange?
- What is relatable?
- What is funny?
- What detail would make someone stop scrolling?
- Why would a reader care?
- What might make someone share the story with a friend?

The writer should focus on one strong central angle instead of trying to include every discovered fact.

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

# 9. Writer Stage

The Writer Prompt should combine:

1. Writer profile
2. Article title
3. Topic
4. Editorial direction
5. Research package
6. Selected story angle
7. ViralStrend editorial rules

The writer should write as the assigned writer, not as a generic AI assistant.

For Alex Carter, the voice should remain:

- Curious
- Observant
- Conversational
- Sharp
- Slightly witty
- Relaxed
- Professionally written

The writer should not try to sound academic or overly intelligent.

The reader should feel:

> "That's interesting. I didn't know that."

---

# 10. Hook

The first paragraph is extremely important.

The article should start with the most interesting aspect of the story.

Possible approaches:

- Surprising fact
- Unusual detail
- Strange situation
- Relatable observation
- Contradiction
- Recent development
- Interesting question

Avoid generic introductions such as:

- "In today's rapidly changing world..."
- "In the ever-evolving digital landscape..."
- "In this article, we will explore..."
- "Let's dive in..."

The opening should immediately give the reader a reason to continue.

Recommended internal test:

> Would someone who knows nothing about this topic want to read the next paragraph?

---

# 11. Storytelling

Articles should not feel like:

Fact → Fact → Fact → Fact → Conclusion.

They should tell a story.

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

---

# 12. Human Writing Quality

The article should feel:

- Natural
- Fluid
- Conversational
- Intelligent
- Relaxed
- Engaging
- Professionally edited

Use natural contractions:

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

Use occasional short paragraphs for emphasis.

Do not intentionally introduce grammatical mistakes.

"Human" does not mean "bad English."

---

# 13. Humor

Humor is part of the ViralStrend identity, but it should not be forced.

For Alex:

- Dry
- Observational
- Slightly sarcastic
- Playful
- Self-aware

Do NOT require a joke in every paragraph.

Do NOT use childish humor.

Do NOT overuse internet slang.

Do NOT make serious subjects into comedy.

A good rule:

> One genuinely good observation is better than five forced jokes.

---

# 14. Editorial Side Comment

Alex can include one short editorial side comment when there is a natural opportunity.

Maximum:

**2 per article**

Preferred:

**1**

Example HTML:

```html
<div class="editor-note">
<p>💬 Short witty observation</p>
</div>
```

The comment must be:

- Relevant
- Short
- Natural
- Original
- Slightly witty
- Written in the writer's voice
- Never promotional

Do not reuse the same comment across articles.

---

# 15. Article Length

Do NOT force a fixed word count.

Do NOT tell the model:

> Write exactly 1500 words.

Instead:

> Write enough to fully develop the story. Do not expand the article merely to reach a word count.

A short story can be concise.

A complex story can be longer.

Every paragraph must earn its place.

Remove:

- Repetition
- Empty statements
- Generic observations
- Artificial transitions
- Keyword stuffing
- Sentences written only to increase word count

---

# 16. SEO

SEO should be natural.

The article should contain:

- Main topic
- Relevant terminology
- Useful semantic context
- Natural headings
- Appropriate meta title
- Meta description
- Relevant keywords

But:

**Do not write for search engines.**

Do not:

- Repeat keywords unnaturally
- Stuff keywords into headings
- Write awkward SEO sentences
- Add unnecessary sections just for keywords

The goal is:

> SEO that is invisible to the reader.

---

# 17. AI Editor Stage

After the Writer finishes, send the article to a separate AI Editor.

Input:

```text
Original title
Research package
Writer profile
Article HTML
```

The Editor should not automatically rewrite everything.

Instruction:

> Preserve strong writing. Only change text when improvement is necessary.

The Editor checks:

### Hook
- Is the opening strong?
- Does it create curiosity?

### Story
- Does the article have a clear angle?
- Does it move forward?
- Does every paragraph add something?

### Writing
- Is the English natural?
- Are sentences varied?
- Are paragraphs readable?

### Personality
- Does the writer's voice appear?
- Does the article feel generic?

### Humor
- Is humor natural?
- Is anything forced?

### Accuracy
- Are factual claims supported?
- Are quotes genuine?
- Are claims correctly qualified?

### SEO
- Is SEO natural?
- Is there keyword stuffing?

### Ending
- Does the article end naturally?
- Does it avoid an artificial "In conclusion"?

### AI patterns
Look for:

- Generic introductions
- Repetitive phrasing
- Mechanical transitions
- Repeated conclusions
- Excessive headings
- Artificially polished language
- Filler

---

# 18. Quality Gate

After editing, the system should decide whether the article is ready.

Suggested internal checks:

```json
{
  "quality_check": {
    "hook": 9,
    "originality": 9,
    "readability": 9,
    "storytelling": 8,
    "factual_support": 10,
    "writer_voice": 9,
    "humor": 8,
    "seo_naturalness": 9,
    "overall": 9
  }
}
```

These scores are internal development signals only.

Suggested rules:

```text
factual_support < 8
→ reject / revise

hook < 7
→ rewrite

writer_voice < 7
→ rewrite

originality < 7
→ rewrite

overall < 8
→ send back to editor
```

Do not publish based only on a numerical score. The actual article must be reviewed by the system's editorial logic.

---

# 19. Final Article HTML

The final article should be clean semantic HTML suitable for WordPress.

Normally:

```html
<h1>...</h1>

<p>...</p>

<p>...</p>

<h2>...</h2>

<p>...</p>

<div class="editor-note">
<p>💬 ...</p>
</div>

<p>...</p>
```

Rules:

- Exactly one H1
- H2 only when useful
- H3 only when necessary
- `<p>` for paragraphs
- `<strong>` and `<em>` only when useful
- `<blockquote>` for genuine quotations
- `<ul>` / `<ol>` only when useful
- `<a>` for relevant editorial links
- No Markdown
- No Markdown code fences
- No JavaScript
- No unnecessary CSS
- No fake URLs
- No fake quotations

The existing Alex prompt already follows this HTML philosophy.

---

# 20. Images

Every article should have at least **3 useful images**.

Do not use three random images simply to satisfy a number.

Recommended structure:

### Image 1 — Hero

Represents the main story or central idea.

Placement:
After or around the introduction.

### Image 2 — Supporting

Helps explain an important part of the story.

Placement:
Middle of article.

### Image 3 — Context / Supporting

Provides another relevant visual perspective.

Placement:
Later in the article.

Each image should have:

```json
{
  "role": "hero",
  "placement": "after-introduction",
  "prompt": "...",
  "alt": "...",
  "caption": "..."
}
```

The image planner should receive the final article so that image concepts are based on the actual story.

Do not create image URLs before the image exists.

---

# 21. Important Image Principle

Images should add editorial value.

Avoid:

- Random stock-style images
- Repeating the same visual
- Images unrelated to the paragraph
- Fake documentary images presented as genuine evidence

For real-world events, use appropriate real/licensed/source images when required.

For illustrations, the visual should clearly function as an illustration rather than misleading the reader into thinking it is documentary evidence.

---

# 22. SEO Output

The final system should also return:

```json
{
  "seo": {
    "meta_title": "...",
    "meta_description": "...",
    "focus_keyword": "...",
    "secondary_keywords": []
  }
}
```

The metadata should accurately describe the article.

Do not create clickbait metadata that promises something the article does not contain.

---

# 23. Final API Output

Recommended final structure:

```json
{
  "status": "ready",

  "writer": {
    "id": "alex_carter",
    "name": "Alex Carter"
  },

  "article": {
    "title": "...",
    "slug": "...",
    "category": "...",
    "excerpt": "...",
    "html": "..."
  },

  "seo": {
    "meta_title": "...",
    "meta_description": "...",
    "focus_keyword": "...",
    "secondary_keywords": []
  },

  "images": [
    {
      "role": "hero",
      "prompt": "...",
      "alt": "...",
      "caption": "..."
    },
    {
      "role": "supporting",
      "prompt": "...",
      "alt": "...",
      "caption": "..."
    },
    {
      "role": "supporting",
      "prompt": "...",
      "alt": "...",
      "caption": "..."
    }
  ],

  "editor": {
    "approved": true,
    "issues": []
  }
}
```

---

# 24. WordPress Workflow

The programmer should eventually be able to automate:

```text
Get next pending article
↓
Load writer profile
↓
Research
↓
Select story angle
↓
Generate article
↓
Run editor
↓
Quality gate
↓
Generate image prompts
↓
Generate/download images
↓
Upload images
↓
Insert images into article
↓
Generate SEO metadata
↓
Create WordPress post
↓
Save as Draft
```

Initially, use:

**WordPress Draft**

rather than fully automatic publishing.

This allows the first batch to be checked manually.

---

# 25. Recommended Development Strategy

Do NOT build all three writers immediately.

Start with:

**Alex Carter**

Test the system on 3–5 existing titles.

For example:

1. We Spend Way Too Much Time Thinking About How One Text Message Sounds
2. Why Do We Screenshot Everything Even Things We Never Look At Again
3. You Don't Even Like This Video — So Why Are You Still Watching It

Evaluate:

- Article quality
- Writer personality
- Hook quality
- Humor
- Naturalness
- Research quality
- HTML
- Image prompts
- Editor performance

Once Alex is stable:

→ Add Writer 2

→ Add Writer 3

The engine should remain the same; only the writer profile changes.

---

# 26. Core Principle for the Programmer

The most important idea is:

> **Do not build an AI article generator. Build a small editorial pipeline.**

The model should have different responsibilities at different stages:

```text
Researcher
   ↓
Story-angle editor
   ↓
Writer
   ↓
Senior editor
   ↓
Quality gate
   ↓
Image planner
   ↓
SEO formatter
```

This gives much more control than one huge prompt.

---

# 27. Expected Result

For the reader, the final article should feel like:

> A real ViralStrend story written by a recognizable writer.

It should NOT feel like:

> A generic AI article created from a keyword.

The system should prioritize:

1. Interesting story
2. Strong angle
3. Natural writing
4. Writer personality
5. Factual discipline
6. Original editorial value
7. Readability
8. Useful visuals
9. Natural SEO
10. Clean WordPress HTML

---

# 28. First Implementation Target

For the first version, the programmer only needs to implement:

```text
Article Queue
+
Writer Profiles
+
Research Input
+
Writer API Call
+
Editor API Call
+
Image Planner API Call
+
JSON validation
+
WordPress Draft creation
```

Do not overcomplicate the first version.

Once the quality is proven, add:

- Automatic image generation
- Automatic image upload
- Automatic scheduling
- More writers
- More categories
- Analytics
- Retry handling
- Quality history
- Editorial dashboard
