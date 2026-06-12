# Order and GM Copy Verification Notes

- Local database question order was updated and verified with SQL: convention is display order 1, GM selection is display order 2, open-ended feedback is display order 3, adventure is display order 4, the three rating/reporting questions are display orders 5–7, and GM-interest/application questions remain display orders 8–11.
- Browser validation at `http://localhost:3000` confirmed that after selecting a convention and GM, the next screen is the open-ended feedback question, making it the third survey question in the respondent flow.

The local development server briefly stopped during the first pass through the rating sequence. It was restarted on port 3000, and browser validation resumed from the survey start screen.

After restarting the dev server and rerunning the first steps, browser validation again confirmed the open-ended feedback prompt appears immediately after convention and GM selection, making it the third survey screen.

The rerun confirmed the later survey sequence remains intact after the third-position feedback question: adventure selection, GM rating, adventure rating, NPS, then the required GM-interest question.

Browser validation reached the GM application from the GM-interest Yes path. The application retained coupon retrieval and Back/Next controls, but the first application step did not visibly show the new promotional GM-program copy above the GM first-name field, so the copy needs to be adjusted in the component before final delivery.

After the component adjustment, browser validation confirmed that entering the GM application now changes the section heading to "GM Application" and shows the promotional copy: "Great GMs are the heroes who make every table unforgettable..." The coupon retrieval banner remains visible with the issued coupon code and Copy button, and Back/Next controls remain available on the GM application step.
