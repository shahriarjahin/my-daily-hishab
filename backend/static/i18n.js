'use strict';
// Translate presentation only. Account names, entered text, values and API keys stay unchanged.
const bnMessages={
 'Liquid Glass':'লিকুইড গ্লাস',
 'Developed by':'নির্মাতা','Courtesy of':'সৌজন্যে','Back':'পিছনে','Overview':'এক নজরে','Transactions':'লেনদেন','Plan':'পরিকল্পনা','Insights':'পরিসংখ্যান','More':'আরও',
 'Budget':'বাজেট','Budgets':'বাজেট','Savings & goals':'সঞ্চয় ও লক্ষ্য','Regulars':'নিয়মিত খরচ','Wallets':'ওয়ালেট','Loans':'ঋণ',
 'AI advisor':'এআই পরামর্শ','Import expenses':'খরচ যুক্ত করুন','Settings':'সেটিংস','Categories':'বিভাগ','AI connections':'এআই সংযোগ','Data & app':'তথ্য ও অ্যাপ',
 'My workspace':'আমার হিসাব','WORKSPACE':'আমার হিসাব','MANAGE':'পরিচালনা','YOUR ACCOUNT':'আপনার অ্যাকাউন্ট','YOUR DATA':'আপনার তথ্য',
 'Synced to your account':'অ্যাকাউন্টে সংরক্ষিত','Total balance':'মোট ব্যালেন্স','All wallets':'সব ওয়ালেট','Income this month':'এ মাসের আয়','Expenses this month':'এ মাসের খরচ',
 'Quick entry':'দ্রুত যুক্ত করুন','English, বাংলা or Banglish':'ইংরেজি, বাংলা বা বাংলিশ','Wallet':'ওয়ালেট','Balance':'ব্যালেন্স','Available balance':'ব্যবহারযোগ্য ব্যালেন্স',
 'Review before saving':'সংরক্ষণের আগে যাচাই','Quick save on':'সরাসরি সংরক্ষণ চালু','Recent entries':'সাম্প্রতিক লেনদেন','View all':'সব দেখুন','Monthly plan':'মাসিক পরিকল্পনা','Ask AI':'এআইকে জিজ্ঞেস করুন',
 'No entries yet':'এখনও কোনো লেনদেন নেই','Add entry':'লেনদেন যোগ করুন','Add transaction':'লেনদেন যোগ করুন','Import':'ইমপোর্ট','Period':'সময়কাল','All time':'সব সময়','Today':'আজ',
 'This week':'এই সপ্তাহ','This month':'এই মাস','This year':'এই বছর','Filters':'ফিল্টার','Export view':'দেখানো তথ্য ডাউনলোড','Type':'ধরন','All types':'সব ধরন',
 'Income':'আয়','Expense':'খরচ','Expenses':'খরচ','Transfers':'স্থানান্তর','Transfer':'স্থানান্তর','Opening balances':'প্রারম্ভিক ব্যালেন্স','Opening balance':'প্রারম্ভিক ব্যালেন্স','Repayments':'পরিশোধ',
 'Total income':'মোট আয়','Total spent':'মোট খরচ','Entries':'লেনদেন সংখ্যা','Initial balance':'শুরুর ব্যালেন্স','Date not recorded':'তারিখ সংরক্ষিত নেই',
 'Income and expense totals exclude opening balances, transfers and loans.':'শুরুর ব্যালেন্স, স্থানান্তর ও ঋণ আয়-খরচের হিসাবে ধরা হয় না.',
 'Nothing in this view.':'কোনো তথ্য পাওয়া যায়নি','Adjust the filters, or add your next entry.':'ফিল্টার বদলান বা লেনদেন যোগ করুন.','Adjust filters':'ফিল্টার পরিবর্তন',
 'Advanced filters':'বিস্তারিত ফিল্টার','Select wallets':'ওয়ালেট নির্বাচন','Select categories':'বিভাগ নির্বাচন','Leave all unchecked to include every wallet.':'সব ওয়ালেট দেখতে কোনোটি নির্বাচন করবেন না.',
 'Minimum amount (৳)':'সর্বনিম্ন পরিমাণ (৳)','Maximum amount (৳)':'সর্বোচ্চ পরিমাণ (৳)','From date':'শুরুর তারিখ','To date':'শেষের তারিখ','Reset all filters':'ফিল্টার মুছুন','Apply filters':'প্রয়োগ করুন',
 'Accounts':'অ্যাকাউন্ট','Add wallet':'ওয়ালেট যোগ করুন','Edit wallet':'ওয়ালেট সম্পাদনা','Set balances with AI':'এআই দিয়ে ব্যালেন্স দিন','Wallet name':'ওয়ালেটের নাম','Opening balance (৳)':'প্রারম্ভিক ব্যালেন্স (৳)',
 'Save wallet':'সংরক্ষণ করুন','Create wallet':'ওয়ালেট তৈরি করুন','Your wallets, in your words.':'ওয়ালেটের ব্যালেন্স লিখুন','Tell us how much is in each wallet':'কোন ওয়ালেটে কত টাকা আছে?',
 'Enter current balances, not income. Review before applying.':'বর্তমান ব্যালেন্স লিখুন, আয় নয়। সংরক্ষণের আগে যাচাই করুন.','Find wallet balances':'ব্যালেন্স খুঁজুন',
 'Wallet balances':'ওয়ালেটের ব্যালেন্স','Current balance':'বর্তমান ব্যালেন্স','New wallet':'নতুন ওয়ালেট','Existing wallet':'আগের ওয়ালেট','Apply balances':'ব্যালেন্স সংরক্ষণ',
 'Move money between wallets.':'ওয়ালেটের মধ্যে স্থানান্তর','From wallet':'যে ওয়ালেট থেকে','To wallet':'যে ওয়ালেটে যাবে','Amount (৳)':'পরিমাণ (৳)','Note':'নোট','Record transfer':'স্থানান্তর সংরক্ষণ',
 'Moves money between wallets. Total balance stays the same.':'ওয়ালেট বদলাবে, মোট ব্যালেন্স একই থাকবে.','Wallet transfer':'ওয়ালেট স্থানান্তর','Wallet movement':'টাকা স্থানান্তর','Outside wallets':'ওয়ালেটের বাইরে',
 'Description':'বিবরণ','Category':'বিভাগ','Date':'তারিখ','Save entry':'সংরক্ষণ করুন','Save changes':'পরিবর্তন সংরক্ষণ','Cancel':'বাতিল','Save':'সংরক্ষণ','Confirm':'নিশ্চিত করুন','Remove':'মুছুন','Edit':'সম্পাদনা',
 'Smart entry':'এআই দিয়ে লিখুন','Manual entry':'নিজে লিখুন','Type an entry':'লিখে যুক্ত করুন','Import SMS / receipt':'এসএমএস / রসিদ যুক্ত করুন','What happened?':'কী লেনদেন হয়েছে?',
 'Find transactions':'লেনদেন খুঁজুন','Choose a wallet. Named wallets in your entry take priority.':'ওয়ালেট বাছুন। লেখায় ওয়ালেটের নাম থাকলে সেটিই নেওয়া হবে.',
 'Review entries':'লেনদেন যাচাই','Quantity (optional)':'পরিমাণ / সংখ্যা (ঐচ্ছিক)','Unit (optional)':'একক (ঐচ্ছিক)','Close dialog':'বন্ধ করুন','Close':'বন্ধ করুন',
 'Monthly spending cap':'মাসিক খরচের সীমা','Daily safe limit':'দৈনিক খরচের সীমা','Today’s remaining':'আজ বাকি','Unspent budget':'বাজেটে বাকি','Saved this month':'এ মাসের সঞ্চয়','Available in wallets':'ওয়ালেটে ব্যবহারযোগ্য',
 'Not set':'নির্ধারিত নয়','Set your monthly budget first':'আগে মাসিক বাজেট দিন','Spending on track':'খরচ সীমার মধ্যে আছে','Above today’s pace':'আজকের সীমার বেশি খরচ',
 'Daily limit adjusts to the days left.':'মাসের বাকি দিন অনুযায়ী দৈনিক সীমা বদলায়.','Your remaining budget exceeds available wallet funds.':'বাকি বাজেট ওয়ালেটের টাকার চেয়ে বেশি.',
 'Needs, wants & savings':'প্রয়োজন, শখ ও সঞ্চয়','Edit plan':'পরিকল্পনা বদলান','Planned income':'পরিকল্পিত আয়','Recorded income':'সংরক্ষিত আয়','Opening balances are excluded.':'শুরুর ব্যালেন্স বাদে.',
 'Needs':'প্রয়োজন','Wants':'শখ','Savings':'সঞ্চয়','Needs income':'আয় দিন','Over target':'লক্ষ্যের বেশি','Within target':'লক্ষ্যের মধ্যে','Tracking':'অগ্রগতি','Spent':'খরচ','Saved':'সঞ্চিত','Target':'লক্ষ্য',
 'AI budget plan':'এআই বাজেট পরিকল্পনা','Category budget':'বিভাগের বাজেট','Category allocations':'বিভাগভিত্তিক বরাদ্দ','Edit limit':'সীমা বদলান','Monthly spending limit (৳)':'মাসিক খরচের সীমা (৳)',
 'Expense category':'খরচের বিভাগ','Set a category budget':'বিভাগের বাজেট দিন','Update category budget':'বিভাগের বাজেট বদলান','Save budget':'বাজেট সংরক্ষণ',
 'Every category can have a plan.':'এখনও বিভাগের বাজেট নেই','Set a category limit, or let AI suggest an allocation for you.':'নিজে বাজেট দিন বা এআইয়ের পরামর্শ নিন.','Add category limit':'বিভাগের সীমা দিন',
 'Monthly spending cap (৳)':'মাসিক খরচের সীমা (৳)','Expected monthly income (৳)':'সম্ভাব্য মাসিক আয় (৳)','Monthly savings target (৳)':'মাসিক সঞ্চয়ের লক্ষ্য (৳)',
 'Needs (%)':'প্রয়োজন (%)','Wants (%)':'শখ (%)','Savings (%)':'সঞ্চয় (%)','Save plan':'পরিকল্পনা সংরক্ষণ','Use monthly income, excluding existing balances.':'বর্তমান ব্যালেন্স বাদ দিয়ে মাসিক আয় দিন.',
 'What should your plan prioritize?':'কোন খরচকে অগ্রাধিকার দেবেন?','Generate plan':'পরিকল্পনা তৈরি','Uses your account summary. Review the plan before applying.':'আপনার হিসাব ব্যবহার করবে। প্রয়োগের আগে যাচাই করুন.',
 'Review your AI budget plan.':'এআইয়ের বাজেট যাচাই করুন','Applying replaces existing category limits. Set a proposed amount to 0 to omit it. No money will be moved.':'এটি আগের বিভাগের বাজেট বদলাবে। বাদ দিতে শূন্য দিন। টাকা স্থানান্তর হবে না.',
 'Reserved in your wallets':'ওয়ালেটে সংরক্ষিত সঞ্চয়','Available for spending':'খরচের জন্য বাকি','Reserved savings stay in the wallet and are excluded from available spending money.':'সঞ্চয়ের টাকা ওয়ালেটেই থাকে, তবে খরচের জন্য ধরা হয় না.',
 'Reserve savings':'সঞ্চয় রাখুন','Create goal':'লক্ষ্য তৈরি','Add savings':'সঞ্চয় যোগ করুন','Remove goal':'লক্ষ্য মুছুন','Reserved savings':'সংরক্ষিত সঞ্চয়','Release':'ছাড় করুন','No savings yet':'এখনও সঞ্চয় নেই',
 'Goal name':'লক্ষ্যের নাম','Target (৳)':'লক্ষ্য (৳)','Target date (optional)':'লক্ষ্যের তারিখ (ঐচ্ছিক)','Color':'রং','Save goal':'লক্ষ্য সংরক্ষণ','Update your goal':'লক্ষ্য বদলান','Goal reached.':'লক্ষ্য পূর্ণ হয়েছে.',
 'Savings category':'সঞ্চয়ের বিভাগ','Goal (optional)':'লক্ষ্য (ঐচ্ছিক)','No specific goal':'নির্দিষ্ট লক্ষ্য নেই','Note (optional)':'নোট (ঐচ্ছিক)','Reserves money in this wallet. Release it to spend it.':'টাকা এই ওয়ালেটে সঞ্চয় হিসেবে থাকবে। খরচ করতে ছাড় করুন.',
 'You owe':'আপনার দেনা','You’re owed':'আপনার পাওনা','Net position':'নিট সম্পদ','Loans and repayments update wallets, not income or expenses.':'ঋণ ও পরিশোধে ওয়ালেট বদলায়, আয়-খরচ নয়.',
 'Record a loan':'ঋণ লিখুন','BORROWED FROM':'যার কাছে দেনা','LENT TO':'যার কাছে পাওনা','Record repayment':'পরিশোধ লিখুন','Settled':'পরিশোধিত','No loans':'কোনো ঋণ নেই',
 'Record money borrowed or lent.':'ঋণ নেওয়া বা দেওয়া লিখুন','Person or institution':'ব্যক্তি বা প্রতিষ্ঠানের নাম','Loan direction':'ঋণের ধরন','Loan amount (৳)':'ঋণের পরিমাণ (৳)',
 'Money received into / lent from':'টাকা জমা / দেওয়ার ওয়ালেট','Due date (optional)':'পরিশোধের তারিখ (ঐচ্ছিক)','Borrowing adds to this wallet. Lending deducts from it.':'ঋণ নিলে ওয়ালেটে টাকা বাড়ে, দিলে কমে.',
 'Record loan':'ঋণ সংরক্ষণ','Record a repayment':'পরিশোধ লিখুন','Repayment (৳)':'পরিশোধের পরিমাণ (৳)','This reduces your wallet balance.':'ওয়ালেটের টাকা কমবে.','This increases your wallet balance.':'ওয়ালেটের টাকা বাড়বে.',
 'Regular spending':'নিয়মিত খরচ','Add tracker':'ট্র্যাকার যোগ করুন','Week':'সপ্তাহ','Month':'মাস','Year':'বছর','Spent on tracked categories':'নিয়মিত বিভাগে খরচ','No regular trackers':'এখনও ট্র্যাকার নেই',
 'Track a category such as coffee or fuel.':'চা, কফি বা জ্বালানির মতো বিভাগ অনুসরণ করুন.','Create a tracker':'ট্র্যাকার তৈরি','Quantities come from matching expense units.':'খরচে লেখা একই এককের পরিমাণ যোগ হবে.',
 'Quick log':'দ্রুত লিখুন','No limit set':'সীমা দেওয়া নেই','Limit exceeded.':'সীমা পেরিয়েছে.','Edit regular tracker':'ট্র্যাকার বদলান','Create a regular tracker':'ট্র্যাকার তৈরি',
 'Tracker name':'ট্র্যাকারের নাম','Daily spending limit (৳, 0 for none)':'দৈনিক খরচের সীমা (৳, না থাকলে ০)','Quantity unit':'পরিমাণের একক','One tracker per expense category.':'একটি খরচের বিভাগে একটি ট্র্যাকার.','Save tracker':'ট্র্যাকার সংরক্ষণ',
 'Total earned':'মোট আয়','Total spent':'মোট খরচ','Net saved':'নিট সঞ্চয়','Money coming your way':'','Across all categories':'সব বিভাগ মিলিয়ে','6 months':'৬ মাস','12 months':'১২ মাস',
 'Monthly trend':'মাসিক চিত্র','Last 7 days':'গত ৭ দিন','By category':'বিভাগ অনুযায়ী','Earned':'আয়','Total spent':'মোট খরচ','Total earned':'মোট আয়','A fresh canvas':'এখনও তথ্য নেই',
 'Your category breakdown will take shape as you record transactions.':'লেনদেন যোগ করলে বিভাগ অনুযায়ী হিসাব দেখা যাবে.','Monthly spending forecast':'মাস শেষে সম্ভাব্য খরচ','Based on your daily spending pace.':'দৈনিক খরচের ভিত্তিতে অনুমান.',
 'Daily pace':'দৈনিক খরচ','Spending cap':'খরচের সীমা','Forecast budget left':'সম্ভাব্য বাকি বাজেট','Record spending to get a useful forecast.':'অনুমান দেখতে খরচ লিখুন.','Set a monthly cap to compare your pace.':'মাসিক সীমা নির্ধারণ করুন.',
 'At this pace you may exceed your monthly cap.':'এই হারে মাসিক সীমা পেরোতে পারেন.','Your current pace is within your monthly cap.':'বর্তমান খরচ মাসিক সীমার মধ্যে আছে.',
 'Spending insights · this month':'এ মাসের খরচের হিসাব','Biggest expense':'সবচেয়ে বড় খরচ','Most active day':'সবচেয়ে বেশি লেনদেনের দিন','Average per expense':'প্রতি খরচের গড়','Categories used':'ব্যবহৃত বিভাগ','Savings rate':'সঞ্চয়ের হার','Budget remaining':'বাজেটে বাকি','Needs a budget':'বাজেট দিন',
 'Wallets & loans':'ওয়ালেট ও ঋণ','Question':'প্রশ্ন','Clear chat':'আলোচনা মুছুন','You':'আপনি','AI':'এআই','Shares your account summary and chat with connected AI providers.':'সংযুক্ত এআই সেবায় আপনার হিসাবের সারাংশ ও আলোচনা পাঠানো হবে.',
 'SMS or receipt':'এসএমএস বা রসিদ','Paste a message or upload a receipt.':'বার্তা লিখুন বা রসিদ দিন.','SMS, receipt text or instructions':'এসএমএস, রসিদের লেখা বা নির্দেশনা',
 'Receipt image (optional, under 2 MB)':'রসিদের ছবি (ঐচ্ছিক, ২ এমবির কম)','Images are sent to connected AI providers and are not saved.':'ছবি এআই সেবায় পাঠানো হবে, সংরক্ষণ করা হবে না.',
 'Name':'নাম','Appearance':'থিম','Dark':'ডার্ক','Light':'লাইট','System':'সিস্টেম','Language':'ভাষা','Signed in':'প্রবেশ করা আছে','Sign out':'বের হন','Check AI entries before saving.':'সংরক্ষণের আগে এআইয়ের লেনদেন যাচাই করুন.',
 'Expense categories':'খরচের বিভাগ','Income categories':'আয়ের বিভাগ','Savings categories':'সঞ্চয়ের বিভাগ','Add category':'বিভাগ যোগ করুন','Edit category':'বিভাগ বদলান','Create a category':'বিভাগ তৈরি',
 'Category name':'বিভাগের নাম','Category type':'বিভাগের ধরন','Budget group':'বাজেটের দল','Icon':'আইকন','Category color':'বিভাগের রং','Status':'অবস্থা','Save category':'বিভাগ সংরক্ষণ','Archived':'আর্কাইভ',
 'Renaming updates existing entries. Archiving keeps history.':'নাম বদলালে আগের লেনদেনেও বদলাবে। আর্কাইভ করলে ইতিহাস থাকবে.',
 'Food':'খাবার','Transport':'যাতায়াত','Shopping':'কেনাকাটা','Utilities':'বিল ও সেবা','Health':'চিকিৎসা','Education':'শিক্ষা','Entertainment':'বিনোদন','Rent':'ভাড়া','Gifts':'উপহার','Travel':'ভ্রমণ',
 'Salary':'বেতন','Business':'ব্যবসা','Other':'অন্যান্য','Freelance':'ফ্রিল্যান্স','Investment':'বিনিয়োগ','Allowance':'ভাতা','Other Income':'অন্যান্য আয়','DPS / FDR':'ডিপিএস / এফডিআর','Bank Deposit':'ব্যাংক আমানত','Provident Fund':'প্রভিডেন্ট ফান্ড','Gold & Assets':'স্বর্ণ ও সম্পদ','Other Savings':'অন্যান্য সঞ্চয়',
 'Automatic fallback follows provider priority.':'অগ্রাধিকার অনুযায়ী বিকল্প এআই ব্যবহার হবে.','Configure':'সেটিংস','Connect':'সংযোগ দিন','Connected':'সংযুক্ত','Paused':'বন্ধ','Not connected':'সংযুক্ত নয়','Add provider':'এআই সেবা যোগ করুন','Retry providers':'আবার চেষ্টা করুন',
 'Keys are encrypted. Requests may reach multiple connected providers.':'চাবি এনক্রিপ্ট করা থাকে। একাধিক এআই সেবায় অনুরোধ যেতে পারে.','Synced across devices':'সব ডিভাইসে সংরক্ষিত','Saved to your cloud account.':'ক্লাউড অ্যাকাউন্টে সংরক্ষিত.',
 'Export transactions':'লেনদেন ডাউনলোড','Export':'ডাউনলোড','Import previous Hishab records':'পুরোনো হিসাব আনুন','For empty accounts only.':'শুধু খালি অ্যাকাউন্টের জন্য.',
 'Add Hishab to your home screen':'হোম স্ক্রিনে হিসাব যোগ করুন','Install':'ইনস্টল','Currency':'মুদ্রা','Bangladeshi taka · ৳ BDT':'বাংলাদেশি টাকা · ৳ BDT',
 'income':'আয়','expense':'খরচ','savings':'সঞ্চয়','both':'উভয়','needs':'প্রয়োজন','wants':'শখ','active':'চালু','archived':'আর্কাইভ','borrowed':'ঋণ নেওয়া','lent':'ঋণ দেওয়া','transfer':'স্থানান্তর','loan':'ঋণ','repayment':'পরিশোধ',
 'food':'খাবার','transport':'যাতায়াত','shopping':'কেনাকাটা','utilities':'বিল ও সেবা','health':'চিকিৎসা','education':'শিক্ষা','entertainment':'বিনোদন','rent':'ভাড়া','gifts':'উপহার','salary':'বেতন','travel':'ভ্রমণ','business':'ব্যবসা','other':'অন্যান্য','wallet':'ওয়ালেট',
 'Remove this entry?':'লেনদেনটি মুছবেন?','Keep entry':'রাখুন','Remove entry':'মুছুন','Remove this budget?':'বাজেটটি মুছবেন?','Keep budget':'রাখুন','Remove budget':'মুছুন',
 'Remove this recorded movement?':'স্থানান্তরের হিসাব মুছবেন?','Remove this regular tracker?':'ট্র্যাকারটি মুছবেন?','Remove this goal?':'লক্ষ্যটি মুছবেন?','Release this savings reservation?':'সঞ্চয়ের টাকা ছাড় করবেন?',
 'Clear your advisor conversation?':'এআইয়ের আলোচনা মুছবেন?','Clear conversation':'আলোচনা মুছুন','This removes the saved chat. Your financial records stay in your account.':'শুধু আলোচনা মুছবে, আপনার হিসাব থাকবে.',
 'The reserved amount becomes available for spending again. Wallet cash does not change.':'টাকাটি আবার খরচ করা যাবে। ওয়ালেটের ব্যালেন্স বদলাবে না.',
 'Only the tracker is removed. Your spending entries stay in your account.':'শুধু ট্র্যাকার মুছবে। খরচের লেনদেন থাকবে.','Savings remain reserved and will no longer be linked to this goal.':'সঞ্চয় থাকবে, তবে এই লক্ষ্যে যুক্ত থাকবে না.',
 'Sign in':'প্রবেশ করুন','Create account':'অ্যাকাউন্ট খুলুন','Email address':'ইমেইল','Password':'পাসওয়ার্ড','Welcome back.':'স্বাগতম','A fresh start.':'অ্যাকাউন্ট খুলুন',
 'Sign in to your personal finance workspace.':'আপনার হিসাবে প্রবেশ করুন.','Create your account and make room for clarity.':'নিজের হিসাব রাখতে অ্যাকাউন্ট খুলুন.',
 'Your records are saved in your cloud account. No financial data is stored in this browser.':'আপনার হিসাব ক্লাউড অ্যাকাউন্টে থাকে, এই ব্রাউজারে নয়.',
 'Your password':'আপনার পাসওয়ার্ড','Your name':'আপনার নাম','Search transactions':'লেনদেন খুঁজুন','Search transactions…':'লেনদেন খুঁজুন…','Describe your transactions':'লেনদেনের বিবরণ লিখুন',
 'How can I improve my budget?':'কীভাবে বাজেট আরও ভালো করব?','Lunch 250, rickshaw 60, salary 35k…':'দুপুরের খাবার ২৫০, রিকশা ৬০, বেতন ৩৫ হাজার…',
 'Paid Tk 250 at a restaurant from Cash…':'নগদ থেকে খাবারের জন্য ২৫০ টাকা দিয়েছি…','Your words, your entries':'লিখে লেনদেন যোগ করুন',
 'Switch appearance':'থিম বদলান','Open profile settings':'সেটিংস খুলুন','Open quick actions':'লেনদেন যোগ করুন','Extract transactions':'লেনদেন খুঁজুন','Transaction wallet':'লেনদেনের ওয়ালেট','Main navigation':'মূল মেনু','Mobile navigation':'মূল মেনু','Section navigation':'বিভাগের মেনু',
 'Working…':'অপেক্ষা করুন…','Retry':'আবার চেষ্টা করুন','Couldn’t load your account.':'অ্যাকাউন্ট লোড হয়নি.','Couldn’t reach your cloud workspace.':'ক্লাউডের সঙ্গে সংযোগ হয়নি.',
 'Saved to your cloud account.':'ক্লাউডে সংরক্ষিত হয়েছে.','Saved. A little more clarity.':'সংরক্ষিত হয়েছে.','Your name is saved.':'নাম সংরক্ষিত হয়েছে.','Entry removed.':'লেনদেন মুছে গেছে.','Budget removed.':'বাজেট মুছে গেছে.',
 'Receipt draft cleared.':'রসিদের খসড়া মুছে গেছে.','Updated in your cloud account.':'ক্লাউডে পরিবর্তন সংরক্ষিত হয়েছে.','You’re signed in.':'প্রবেশ করা হয়েছে.',
 'Choose two different wallets.':'দুটি ভিন্ন ওয়ালেট বাছুন.','Choose an existing wallet.':'একটি ওয়ালেট বাছুন.','Choose an active category.':'চালু একটি বিভাগ বাছুন.',
 'Minimum amount must not exceed maximum.':'সর্বনিম্ন পরিমাণ সর্বোচ্চ পরিমাণের বেশি হতে পারে না.','Start date must not follow end date.':'শুরুর তারিখ শেষের তারিখের পরে হতে পারে না.',
 'Choose an image under 2 MB.':'২ এমবির কম ছবি দিন.','Paste a message or choose a receipt image.':'বার্তা লিখুন বা রসিদের ছবি দিন.',
 'Repayment exceeds the remaining loan.':'ঋণের বাকি টাকার চেয়ে পরিশোধ বেশি হয়েছে.','The three percentages must add up to 100.':'তিনটি শতাংশের যোগফল ১০০ হতে হবে.',
 'This wallet has insufficient unreserved money. Release savings or choose another wallet.':'ওয়ালেটে খরচযোগ্য টাকা যথেষ্ট নেই। সঞ্চয় ছাড় করুন বা অন্য ওয়ালেট বাছুন.',
 'Your workspace changed. Reload before saving this change.':'অন্য জায়গা থেকে হিসাব বদলেছে। আবার লোড করে সংরক্ষণ করুন.'
};
const presentationText=new WeakMap(),presentationAttrs=new WeakMap();
const isBangla=()=>state.settings?.language==='bn';
function translateUI(value){if(!isBangla())return value;const raw=String(value),key=raw.trim();let result=bnMessages[key];if(result===undefined){result=key;for(const [pattern,replacement] of [
 [/^← (.+)$/u,(_,label)=>'← '+(bnMessages[label]||label)],
 [/^(Expense categories|Income categories|Savings categories) \((\d+)\)$/u,(_,label,n)=>bnMessages[label]+' ('+n+')'],
 [/^(Needs|Wants|Savings) \((\d+)%\)$/u,(_,label,n)=>bnMessages[label]+' ('+n+'%)'],
 [/^(Spent|Saved|Target|Planned income|Recorded income|Biggest expense):\s*(.*)$/u,(_,label,n)=>bnMessages[label]+': '+n],
 [/^(\d+) days including today$/u,(_,n)=>'আজসহ '+n+' দিন বাকি'],
 [/^(\d+)% used$/u,(_,n)=>n+'% খরচ হয়েছে'],
 [/^(.*) left$/u,(_,n)=>n+' বাকি'],[/^(.*) over$/u,(_,n)=>n+' বেশি'],
 [/^(.*) to go\.$/u,(_,n)=>'আরও '+n+' বাকি.'],[/^(.*) reserved$/u,(_,n)=>n+' সঞ্চিত'],
 [/^Filters \((\d+)\)$/u,(_,n)=>'ফিল্টার ('+n+')'],[/^Entry (\d+)$/u,(_,n)=>'লেনদেন '+n],
 [/^Save (\d+) entr(?:y|ies)$/u,(_,n)=>n+'টি লেনদেন সংরক্ষণ'],
 [/^Edit (.+) wallet$/u,(_,name)=>name+' ওয়ালেট বদলান'],
 [/^Remove entry (\d+)$/u,(_,n)=>n+' নম্বর লেনদেন বাদ দিন'],
 [/^(.*) estimated at month end$/u,(_,n)=>n+' মাস শেষে আনুমানিক'],
 [/^\/ day$/u,()=>'/ দিন'],[/^Daily limit adjusts to the days left\.(.*)$/u,(_,rest)=>'মাসের বাকি দিন অনুযায়ী দৈনিক সীমা বদলায়.'+rest],
 ]){if(pattern.test(result)){result=result.replace(pattern,replacement);break;}}}
 if(result!==key)result=result.replace(/[0-9]/g,digit=>'০১২৩৪৫৬৭৮৯'[Number(digit)]);
 return raw.replace(key,result);
}
function localizeTree(root=document.body){document.documentElement.lang=isBangla()?'bn':'en';const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){const parent=node.parentElement;if(!parent||!node.data.trim()||parent.closest('script,style,textarea,.chat-message p,.transaction-description strong,.wallet-head,.wallet-directory-row>span:nth-child(2),.wallet-brand,.provider-row h3,.provider-row p,.donut-label strong,.brand,.avatar,[data-user-text]'))continue;let record=presentationText.get(node);if(!record||node.data!==record.last)record={original:node.data,last:node.data};const next=translateUI(record.original);if(node.data!==next)node.data=next;record.last=next;presentationText.set(node,record);}
 for(const el of root.querySelectorAll('[placeholder],[aria-label]')){if(el.matches('#language-toggle,[data-user-text],.wallet-card,.wallet-directory-row,.wallet-brand,img'))continue;let records=presentationAttrs.get(el)||{};for(const name of ['placeholder','aria-label']){if(!el.hasAttribute(name))continue;const current=el.getAttribute(name);let record=records[name];if(!record||current!==record.last)record={original:current,last:current};const next=translateUI(record.original);if(next!==current)el.setAttribute(name,next);record.last=next;records[name]=record;}presentationAttrs.set(el,records);}
 const today=document.getElementById('today');if(today){const formatted=new Intl.DateTimeFormat(isBangla()?'bn-BD':'en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Dhaka'}).format(new Date());if(today.textContent!==formatted)today.textContent=formatted;}
}
function languageControls(){let button=document.getElementById('language-toggle');if(!button){button=document.createElement('button');button.id='language-toggle';button.className='language-toggle';button.dataset.action='toggle-language';document.querySelector('.topbar-actions').prepend(button);}const label=isBangla()?'English':'বাংলা';if(button.textContent!==label)button.textContent=label;button.setAttribute('aria-label',isBangla()?'Switch to English':'বাংলা ভাষায় দেখুন');
 if(page==='settings'&&cloudState.signed_in&&!document.getElementById('language-select')){const panel=main.querySelector('.settings-block .panel');panel?.insertAdjacentHTML('beforeend',`<div class="settings-row"><div><h3>Language</h3></div><select class="settings-input" id="language-select" aria-label="Language"><option value="en" ${!isBangla()?'selected':''}>English</option><option value="bn" ${isBangla()?'selected':''}>বাংলা</option></select></div>`);}}
async function changeLanguage(language){if(!['en','bn'].includes(language))return;const button=document.getElementById('language-toggle');if(button)button.disabled=true;try{if(cloudState.signed_in){state.settings=await request('/settings','PATCH',{language});await refresh();}else{state.settings.language=language;renderLogin();}languageControls();localizeTree();}catch(error){toast(error.message);}finally{if(button)button.disabled=false;}}
const languageAction=handleAction;
handleAction=async function(el){if(el.dataset.action==='toggle-language'){await changeLanguage(isBangla()?'en':'bn');return;}return languageAction(el);};
document.addEventListener('change',event=>{if(event.target.id==='language-select')changeLanguage(event.target.value);});
const localizedRender=render;
render=function(){localizedRender();languageControls();backControls();decorateWalletLogos();localizeTree();};
let localizationQueued=false;
new MutationObserver(records=>{if(!records.some(record=>record.type==='childList'||record.target.parentElement?.closest('#main,#entry-dialog,#toast,#navigation,#mobile-navigation,.sidebar-footer'))||localizationQueued)return;localizationQueued=true;queueMicrotask(()=>{localizationQueued=false;languageControls();decorateWalletLogos();localizeTree();});}).observe(document.body,{childList:true,subtree:true,characterData:true});
languageControls();
