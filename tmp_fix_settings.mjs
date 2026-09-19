import { readFileSync, writeFileSync } from 'fs';

const path = 'C:\\Users\\Admin\\Downloads\\FacilityFlow-main\\FacilityFlow-main\\frontend\\src\\app\\(dashboard)\\settings\\page.tsx';
let content = readFileSync(path, 'utf-8');

// 1. Replace Global Email Notifications checkbox section with disabled notice
const oldEmailSection = `            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h4 className="font-semibold text-charcoal">Global Email Notifications</h4>
                <p className="text-xs text-sage">Receive transactional email notifications.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border text-pine focus:ring-pine"
                checked={notifForm.email}
                onChange={(e) => setNotifForm({ ...notifForm, email: e.target.checked })}
              />
            </div>`;

const newEmailSection = `            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h4 className="font-semibold text-charcoal">Email Notifications</h4>
                <p className="text-xs text-sage">Email notifications are currently disabled — no mail server configured.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border text-pine focus:ring-pine"
                disabled
                checked={false}
              />
            </div>`;

content = content.replace(oldEmailSection, newEmailSection);

// 2. Remove email checkbox from each notification category item (the second <label> with Email span)
const emailLabelRegex = /(\s*<label className="flex items-center gap-1\.5 cursor-pointer">\s*<input\s*type="checkbox"\s*checked=\{catState\.email\}\s*onChange=\{(e) =>\s*setNotifForm\(\s*\{\s*\.\.\.notifForm,\s*categories:\s*\{[^}]+},\s*\}\s*\}\s*\)\s*\}\s*\/\s*>\s*<span>Email<\/span>\s*<\/label>\s*)/g;
content = content.replace(emailLabelRegex, '');

// 3. Change "Global In-App Notifications" to "In-App Notifications"
content = content.replace('Global In-App Notifications', 'In-App Notifications');

writeFileSync(path, content);
console.log('Settings page updated successfully');
