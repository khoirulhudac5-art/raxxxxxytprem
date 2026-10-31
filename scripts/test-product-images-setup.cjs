// Static SQL regression checks only. No SQL or production requests are executed.
const fs=require('node:fs'),assert=require('node:assert/strict');
const sql=fs.readFileSync('scripts/setup-product-images.sql','utf8');
const baseline=fs.readFileSync('scripts/setup-testimonials.sql','utf8');
const first=baseline.indexOf(' -- Match the inspected helper body');
const last=baseline.indexOf(' IF NOT (SELECT relrowsecurity',first);
assert.ok(sql.includes(baseline.slice(first,last).trimEnd()),'Helper preflight must match reviewed testimonial setup');
assert.doesNotMatch(sql,/product_images_admin_delete|FROM public\.products|split_part|NOT EXISTS\(/);
assert.match(sql,/AS RESTRICTIVE FOR DELETE TO anon,authenticated\s+USING\(bucket_id<>'product-images'\);/);
assert.match(sql,/AS RESTRICTIVE FOR UPDATE TO anon,authenticated\s+USING\(bucket_id<>'product-images'\) WITH CHECK\(bucket_id<>'product-images'\);/);
assert.match(sql,/'product-images','product-images',true,5242880/);
assert.doesNotMatch(sql,/\b(?:ALTER|DROP)\s+POLICY\b|\b(?:UPDATE|DELETE FROM|ALTER TABLE)\s+public\./i);
assert.ok(sql.includes('product_images_policies_before'));
assert.match(sql,/COMMIT;\s*$/);
const ui=fs.readFileSync('src/components/product-image-upload.tsx','utf8');
assert.ok(ui.includes('upsert:false'));assert.ok(!ui.includes('.remove('));
console.log('PASS: verified helper preflight, public bucket, unconditional app DELETE/UPDATE guards, no product reference query or automatic deletion, existing policies unchanged. Static only.');
