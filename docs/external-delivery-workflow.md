# External Delivery Workflow

This application is designed around a preview-only storage model.

## Stored in app-managed storage

- preview MP3 files
- beat cover art

## Not stored in app-managed storage

- WAV masters
- stems
- exclusive bundles
- full delivery archives

## Delivery link behavior

Delivery links belong to `BeatLicenseDeliveryLink`.

That means:

- one beat can have many licenses
- each license can expose one or more Dropbox links
- different licenses for the same beat can deliver different assets

## Manual stems handling

When `manualFulfillmentRequired` is true:

- order success page still confirms the purchase
- any non-stem links may still be shown if configured
- the buyer is explicitly told stems will be sent manually later
- the admin dashboard shows the order as `PARTIAL` until manual delivery is complete

## Why this design works

- keeps sensitive masters out of app storage
- matches real producer workflows
- allows Dropbox to stay the delivery source of truth
- makes it easy to replace Dropbox with another delivery provider later
