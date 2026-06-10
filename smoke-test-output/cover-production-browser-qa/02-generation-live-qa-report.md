# 02 — Live ComfyUI Generation QA Report

**Module:** Cover Production — Image Generation Pipeline
**Date:** 2026-06-09
**Status:** ✅ PASS — Both Flux and PonyXL generate correct images

---

## ComfyUI Server

| Property | Value |
|----------|-------|
| URL | `http://127.0.0.1:8000` |
| Status | HTTP 200 |
| Endpoint | `/system_stats` |

---

## Flux Generation

| Property | Value |
|----------|-------|
| **Output** | `UBS_BrowserQA_Flux_00001_.png` |
| **Dimensions** | 832 × 1216 |
| **File Size** | 760 KB |
| **Checkpoint** | `flux1-schnell-fp8.safetensors` |
| **Steps** | 4 |
| **Sampler** | euler |
| **Genre** | Thriller |
| **Book Title** | "The Glass Room" |
| **Prompt** | Thriller genre cover prompt (969 chars via buildCoverPrompt) |
| **Queue Position** | 2 |
| **Completion** | ~60s |
| **Visual Result** | Dark moody teal-lit figure — genre-appropriate thriller cover |

### Verification
- ✅ HTTP 200 on POST `/prompt`
- ✅ `prompt_id` accepted and queued
- ✅ Image retrieved via `/view` endpoint
- ✅ Correct dimensions (832×1216)
- ✅ Non-zero file size (760 KB)
- ✅ Real visual content (not blank/noise)
- ✅ Genre-appropriate imagery

---

## PonyXL Generation

| Property | Value |
|----------|-------|
| **Output** | `UBS_BrowserQA_PonyXL_00001_.png` |
| **Dimensions** | 832 × 1216 |
| **File Size** | 1,124 KB |
| **Checkpoint** | `cyberrealisticPony_v180Coreshift.safetensors` |
| **Steps** | 20 |
| **Scheduler** | normal |
| **Genre** | Dark Romance |
| **Book Title** | "Crimson Vow" |
| **Visual Result** | Warm intimate couple scene with beautiful lighting — genre-appropriate romance cover |

### Verification
- ✅ HTTP 200 on POST `/prompt`
- ✅ `prompt_id` accepted and queued
- ✅ Image retrieved via `/view` endpoint
- ✅ Correct dimensions (832×1216)
- ✅ Non-zero file size (1,124 KB)
- ✅ Real visual content (not blank/noise)
- ✅ Genre-appropriate imagery

---

## Generation Pipeline

```
buildCoverPrompt(genre, title, settings)
    → buildCoverWorkflowForModel(model, prompt, negPrompt, settings)
    → POST /prompt  (submit workflow to ComfyUI)
    → poll /history/{prompt_id}  (wait for completion)
    → GET /view?filename=...  (download output image)
```

### Pipeline Verification
- ✅ `buildCoverPrompt` produces valid positive prompt (969 chars for thriller/flux)
- ✅ `buildCoverWorkflowForModel` produces valid ComfyUI workflow JSON
- ✅ Flux uses euler sampler (confirmed via data layer test)
- ✅ PonyXL uses normal scheduler with 20 steps
- ✅ Both models produce images at expected 832×1216 resolution

---

## Conclusion

Both generation pipelines (Flux and PonyXL) are fully functional. The end-to-end flow from prompt building through ComfyUI submission to image retrieval works correctly. Generated images are genre-appropriate and meet dimensional requirements.
