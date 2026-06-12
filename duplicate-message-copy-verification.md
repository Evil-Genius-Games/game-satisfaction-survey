# Duplicate Message Copy Verification

Date: 2026-06-06

The duplicate-survey rejection message was updated and verified in the local survey UI.

## Verified message

> Thanks for playing! You’ve already completed the survey for this convention, GM, and adventure. We’d love to hear from you again—please sign up for another game and share feedback after that session.

## Verification

The browser was already on a duplicate submission attempt for the same convention, GM, and adventure. After re-submitting the duplicate attempt, the updated message appeared inline on the referral question step and the survey did not proceed to the coupon screen.

Screenshot captured during verification: `/home/ubuntu/screenshots/3000-iyyks7n8v8furnj_2026-06-06_23-29-59_9056.webp`

## Automated checks

| Check | Result |
|---|---:|
| TypeScript | Passed |
| Focused duplicate-response test | Passed, 2 tests |

