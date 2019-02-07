/** DEBUG: checking translations */
async function check(bot) {
  for (let i = 0; i < Object.values(localizations).length; i += 1) {
    const obj = Object.values(localizations)[i]
    // for (const v of Object.values(obj)) {
    try {
      await send(Object.values(obj)[0], bot)
    } catch (err) {
      console.info(err, Object.values(obj)[0])
    }
    await sleep(0.5)
    // }
    // await sleep(10)
  }
  console.log('Done sending!')
}

/** Sleep function, takes seconds */
function sleep(s) {
  return new Promise(resolve => setTimeout(resolve, 1000 * s))
}

/** Sending a message to the bot */
async function send(text, bot) {
  await bot.telegram.sendMessage(process.env.ADMIN_ID, text, {
    parse_mode: 'Markdown',
  })
}

const localizations = {
  '📁 Wonderful! *Voicy* will *ignore* all audio files in this chat since now.': {
    fa:
      '\u200F📁 عالیه! وُیسی تمام فایل های صوتی در این چت از الآن رو نادیده میگیره.',
    hi:
      '📁 शानदार! *Voicy* इस चैट में अब आगे से सारी ऑडियो फाइल्स को नज़रअन्दाज़ कर देगा।',
    et: '📁 ድንቅ ! *Voicy* ከአሁን ጀምሮ በዚህ ምልልስ ውስጥ ያሉ ፋይሎችን*ችላ* ይላቸዋል፡፡ ',
    ge:
      '📁 Wunderbar! *Voicy* wird ab sofort alle Audio-Dateien in diesem Chat *ignorieren*.',
    it:
      '📁 Meraviglioso! *Voicy* *ignorerà* tutti i file audio in questa chat a partire da ora.',
    uz:
      '📁 Ajoyib! *Voicy* bu chatdagi barcha audio fayllarni hozirdan boshlab *e�tiborsiz qoldiradi*.',
    fr:
      '📁 Merveilleux! *Voicy* *ignorera* tous les fichiers audio dans cette conversation depuis maintenant.',
    ko:
      '📁 멋져요! *Voicy* 가 지금부터 이 채팅 내의 모든 음성 파일을 *무시* 합니다.',
    ar:
      '\u200F📁 رائع صوت سوف يتجاهل كل الملفات الصوتية المرفقة بهذه المحادثة منذ الآن .',
    az:
      '📁 Möhtəşəm! Bu andan etibarən “Voicy” bu söhbətdəki bütün səs fayllarını “görməməzlikdən gələcək”.',
    am:
      '📁 Հիանալի է! Այս պահից սկսած *Voicy*-ն *կանտեսի* այս չատում եղած բոլոր աուդիոֆայլերը.',
    ch: '📁 太好了！从现在起，*Voicy*将*ignore*这个对话中的所有语音档。',
    ua:
      '📁 Чудово! Відтепер *Войсі* буде *ігнорувати* всі аудіофайли в цьому чаті.',
    no:
      '📁 Herlig! *Voicy* skal *ignorere* alle lydfiler i denne chatten fra nå av.',
    ja:
      '📁 さいこう！ *ヴォイシー * は、チャット内の音声ファイルを全部 *無視* するよ。',
    tr:
      '📁 Harika! *Voicy*, şu andan itibaren bu sohbetteki tüm ses dosyalarını *görmezden gelecektir*.',
    sv:
      '📁 Underbart! *Voicy* kommer *ignorera* alla ljudfiler i den h�r chatten fr�n och med nu.',
    pt:
      '📁 Fantástico! A partir de agora, *Voicy* vai *ignorar* todos os ficheiros de áudio nesta conversa.',
    en:
      '📁 Wonderful! *Voicy* will *ignore* all audio files in this chat since now.',
    es:
      '📁 ¡Maravillosol! *Voicy* *ignorará* todos los archivos de audio en este chat desde ahora.',
    ru:
      '📁 Великолепно! *Войси* теперь будет *игнорировать* все аудио файлы в этом чате.',
  },
  '📁 Wonderful! *Voicy* will *try to recognize* all audio files in this chat since now.': {
    fa:
      '\u200F📁 عالیه! وُیسی تلاش میکنه تمام فایل های صوتی در این چت از الآن رو شناسایی کنه.',
    hi:
      '📁 शानदार! *Voicy* इस चैट में अब आगे से सारी ऑडियो फाइल्स को पहचानने की कोशिश करेगा।',
    et: '📁 ድንቅ ! *Voicy* ከአሁን ጀምሮ በዚህ ምልልስ ውስጥ ያሉ ፋይሎችን*እውቅና ለመስጠት ይሞክራል*፡፡',
    ge:
      '📁 Wunderbar! *Voicy* wird ab sofort versuchen, alle Audio-Dateien in diesem Chat zu *erkennen*.',
    it:
      '📁 Meraviglioso! *Voicy* *tenterà di riconoscere* tutti i file audio in questa chat a partire da ora.',
    uz:
      '📁 Ajoyib! *Voicy* bu chatdagi barcha audio fayllarni hozirdan boshlab *tushunishga harakat qiladi*.',
    fr:
      '📁 Merveilleux! *Voicy* *essaiera de reconnaître* tous les fichiers audio dans cette conversation depuis maintenant.',
    ko:
      '📁 멋져요! *Voicy* 가 지금부터 이 채팅 내의 모든 음성 파일을 *인식* 합니다.',
    ar:
      '\u200F📁 رائع صوت سوف يحاول التعرف على الملفات الصوتية على هذه المحاثة منذ الآن.',
    az:
      '📁 Möhtəşəm! Bu andan tibarən “Voicy” bu söhbətdəki bütün audio faylarını “tanımağa çalışacaq”.',
    am:
      '📁 Հիանալի է! Այս պահից սկսած *Voicy*-ն *կփորձի ճանաչել* այս չատում եղած բոլոր աուդիոֆայլերը.',
    ch: '📁 太好了！从现在起，*Voicy*将*recognize*这个对话中的所有语音档。',
    ua:
      '📁 Чудово! Відтепер *Войсі* буде *намагатися розпізнати* всі аудіо файли в цьому чаті.',
    no:
      '📁 Herlig! *Voicy* skal *prøv å gjenkjenne* alle lydfiler i denne chatten fra nå av.',
    ja:
      '📁 いいねぇ！ *ヴォイシー* は、チャット内の音声ファイルを全部 *理解* するよ。',
    tr:
      '📁 Harika! Voicy, şu andan itibaren bu sohbetteki tüm ses dosyalarını *tanımaya çalışacaktır*.',
    sv:
      '📁 Underbart! *Voicy* kommer *f�rs�ka k�nna igen* alla ljudfiler i den h�r chatten fr�n och med nu.',
    pt:
      '📁 Fantástico! A partir de agora, *Voicy* vai *tentar reconhecer* todos os ficheiros áudio nesta conversa.',
    en:
      '📁 Wonderful! *Voicy* will *try to recognize* all audio files in this chat since now.',
    es:
      '📁 ¡Maravilloso! *Voicy* *intentará reconocer* todos los archivos de audio en este chat desde ahora.',
    ru:
      '📁 Великолепно! *Войси* теперь будет *пробовать перевести в текст* все аудио файлы в этом чате.',
  },
  'Reply to this message with the Google Cloud credentials file (.json) to set up Google Speech voice recognition. Not sure what is this and how to get it? Check out [our quick tutorial](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).': {
    fa:
      '\u200Fبه این پیام با فایل اعتبارنامه Google Cloud (.json) پاسخ بده تا تشخیص صدای Google Speech رو تنظیم کنید. مطمئن نیستید که این چی هست و چجوری میشه گرفتش؟ ]فیلم آموزشی سریع ما روببینید https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8.',
    hi:
      'Google Speech के वॉयस पहचान को सेट करने के लिए Google Cloud क्रेडेंशियल फाइल (.json) के साथ इस मैसेज का रिप्लाई करें। समझ में नहीं आ रहा है कि यह क्या है और इसे कैसे पाया जा सकता है? यह देखें [हमारा त्वरित ट्यूटोरियल](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8)।',
    et:
      'የ Google Speech voice recognition (ጉግልን የንግግር ድምጽ መለያን) ለማስጀመር ለዚህ መልዕክት የ Google Cloud credentials file (ጉግል ክላውድ መረጃ ፋይሎችን) በመጠቀም ይመልሱ፡፡ይህ ምንእንደሆነ እና እንዴት እንደሚያደርጉት እርግጠኛ አይደሉም?[ፈጣን የማጥኛ ድረ-ገጻችንን] (https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8) ይመልከቱ፡፡',
    ge:
      'Antworte auf diese Nachricht mit der JSON-Datei mit den Anmeldeinformationen für die Google Cloud, um die Google Speech-Spracherkennung einzurichten. Nicht ganz sicher, was das ist und woher du die bekommen kannst? Schau dir [unsere Kurzanleitung](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8) an.',
    it:
      'Rispondi a questo messaggio con il file delle credenziali di Google Cloud (.json) per impostare il riconoscimento vocale di Google Speech. Non sei sicuro di cosa si tratta e di come ottenerlo? Dai un’occhiata [il nostro breve tutorial](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).',
    uz:
      'Google nutqni tushunish xizmatini sozlash uchun bu xabarga Google Cloud xizmatidagi shaxsiy ma�lumotlaringiz fayli (.json) bilan javob qaytaring. Buni qanday amalga oshirishni bilmasangiz, [qo�llanmamiz](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8) bilan tanishing.',
    fr:
      "Répondez à ce message avec le fichier (.json) d'informations d'identification de Google Cloud pour configurer reconnaissance vocale de Google Speech. Vous ne savez pas ce que c'est et comment l'obtenir? Consultez notre tutoriel rapide (https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).",
    ko:
      '구글 스피치 음성 인식을 설정하기 위해 구글 클라우드 크리덴셜 파일 (.json)을 이용하여 이 메세지에 답장하세요. 이것이 무엇인지, 어떻게 하는지 알고 싶으신가요? [빠른 튜토리얼](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8)을 확인해보세요.',
    ar:
      '\u200F رد على هذه الرسالة مع ملف سحابة جوجل للبينات المعتمدة (.json) لإعداد التعرف الصوتي لدى جوجل . هل تحتاج لمذيد من المعلومات حول كيفية الاعداد ؟ تعرف على المذيد من خلال دورتنا التعليمية (https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).',
    az:
      'Google Speech səs tanımasını quraşdırmaq üçün bu mesajı Google Cloud etibarnamə fayl(.json)ı ilə cavablayın. Nə olduğu və necə əldə edəcəyinizi bilmirsiniz? Bunu yoxlayın [qısa təlimimiz](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8)',
    am:
      'Պատասխանի՛ր այս նամակին Google Cloud-ի երաշխավորագիրների միջոցով (.json) Google Speech ձայնի ճանաչումը կարգավորելու համար. Համոզված չես ինչ է սա և ինչպես ձեռք բերել այն?. Ստուգի՛ր [մեր արագ խորհրդատվությունը](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8)',
    ch:
      '要设立Google语音辨识，请回覆此讯息，并在讯息中输入Google云端凭证档案（.json格式）。您不知道这是什么吗？还是您不知道如何取得这个档案？来观看我们的[快速教学](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8)吧！',
    ua:
      'Дайте відповідь на це повідомлення за допомогою ідентифікації особи Google Cloud (.json) , щоб налаштувати розпізнавання мовлення Google. Не впевнені, що це таке та як це зробити? Перегляньте [наша швидка інструкція](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).',
    no:
      'Svar på denne melding med din Google Cloud sine legitimasjon fil (.json) for å konfigurere Google-stemmegjenkjenning. Ikke sikker på hva er dette, og hvordan får man det? Sjekk ut [vår enkel tutorial](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).',
    ja:
      'グーグルクラウド専用ファイル (.json) を使って返信をし、グーグルスピーチ音声認識をセットアップしましょう。これが何かわからず、どう取得すればいいかわからない？ [簡単チュートリアル](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8)をご覧ください。',
    tr:
      'Google Speech ses tanımayı ayarlamak için, bu mesajı Google Cloud kimlik bilgileri dosyası (.json) ile yanıtlayın. Bunun ne olduğundan ve nasıl bulunacağından emin değil misin? [Eğitim sayfasına](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8) bir göz atın.',
    sv:
      'Svara p� det h�r meddelandet med autentiseringsuppgifterna f�r Google Cloud (.json) f�r att konfigurera Google taligenk�nning. Inte s�ker p� vad det h�r �r eller hur man skaffar det? Se v�r[snabbguide](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).',
    pt:
      'Responda a esta mensagem com o ficheiro das credenciais Google Cloud (.json) para configurar o reconhecimento de voz Google Speech. Desconhece o ficheiro e como obtê-lo? Confira [o nosso tutorial rápido](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).',
    en:
      'Reply to this message with the Google Cloud credentials file (.json) to set up Google Speech voice recognition. Not sure what is this and how to get it? Check out [our quick tutorial](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).',
    es:
      'Responde a este mensaje con el archivo de credenciales de Google Cloud (.json) para configurar el reconocimiento de voz de Google Speech. ¿No está seguro de lo que es esto y cómo lograrlo? Revise [nuestro tutorial rápido](https://medium.com/@nikitakolmogorov/setting-up-google-speech-for-voicybot-b806545750f8).',
    ru:
      'Ответьте на это сообщение с файлом аутентификации для Google Cloud (.json), чтобы настроить распознавание речи от Google Speech. Не уверены, как сделать, чтобы все заработало? Прочитайте [наше короткое руководство](https://medium.com/@nikitakolmogorov/%D1%83%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BA%D0%B0-google-speech-%D0%B2-voicybot-9f8268cd58c6).',
  },
  'Sorry, you should reply with a credentials document.': {
    fa: '\u200Fبا عرض پوزش، شما باید با یک سند اعتبارنامه پاسخ دهید.',
    hi:
      'क्षमा करें, आपको किसी क्रेडेंशियल डॉक्यूमेंट के साथ रिप्लाई करना चाहिए।',
    et: 'ይቅርታ፡ከመረጃዎችዎ ጋር ሊመልሱ ይገባል፡፡',
    ge:
      'Sorry, du solltest mit einem Dokument mit Anmeldeinformationen antworten.',
    it: 'Spiacente, dovresti rispondere con un documento di credenziali.',
    uz: 'Uzr, shaxsiy ma�lumotlaringiz bor hujjat bilan javob qaytaring.',
    fr: "Désolé, vous devez répondre avec un document d'identification.",
    ko: '죄송합니다, 당신은 크리덴셜 문서로 답장하셔야 합니다.',
    ar: '\u200Fعذراً , يجب الرد مع إرفاق ملف البيانات المعتمدة .',
    az: 'Bağışlayın, etibarnamə sənədi ilə cavablamalısınız.',
    am:
      'Ներողություն, դուք պետք է պատասխանեք երաշխավորագիր- փաստաթղթի միջոցով.',
    ch: '抱歉！您的回覆需要是云端凭证。',
    ua: 'Вибачте, ви повинні відповісти з документом ідентифікації особи.',
    no: 'Beklager, du bør svare med et et legitimasjonsdokument.',
    ja: 'すみません、専用ファイルを用いてください。',
    tr: 'Üzgünüm, ama bir kimlik dosyası ile yanıt vermelisiniz.',
    sv: 'F�rl�t, du skulle svara med ett dokument f�r autentisering.',
    pt: 'Lamentamos, mas deve responder com o documento das credenciais.',
    en: 'Sorry, you should reply with a credentials document.',
    es: 'Lo siento, debe responder con un documento de credenciales.',
    ru: 'Ответьте, пожалуйста, аутентификационным документом.',
  },
  "Sorry, document's mime type should be .": {
    fa: "\u200Fبا عرض پوزش، نوع mime سند باید 'text/plain' باشد.",
    hi: "क्षमा करें, डॉक्यूमेंट का माइम टाइप 'text/plain' होना चाहिए।",
    et: "ይቅርታ፡የመረጃዎችዎ's mime አይነት 'text/plain' ሊሆን ይገባዋል፡፡",
    ge: "Entschuldigung, der MIME-Typ des Dokuments sollte 'text/plain' sein.",
    it:
      'Spiacente, il formato tipo del documento ‘s dovrebbe essere ’testopiano’.',
    uz: "Uzr, hujjatning mime turi 'text/plain' kabi bo�lishi lozim.",
    fr: 'Désolé, le type mime du document doit être texte ordinaire.',
    ko:
      "죄송합니다, 문서의 다목적 인터넷 메일 확장 규격(마임, MIME) 종류는 'text/plain' 이어야 합니다.",
    ar: "\u200Fعذراً , الملفات من نوع mime يجب ان تكون be 'text/plain'.",
    az: "Bağışlayın, sənədlərin yazılış mimi belə olmalıdır 'text/plain'",
    am: "Ներողություն, փաստաթղթի միմիկան պետք է լինի 'տեքստ/դաշտ'.",
    ch: "抱歉！档案类型需要是'text/plain'。",
    ua: "Вибачте, тип документа повинен бути 'text/plain'.",
    no: "Beklager, dokument sine mime type burde være 'tekst/plain'.",
    ja: "すみません、document's mimeは 'text/plain'であるべきです。",
    tr: "Üzgünüm, ama belgenin mime türü 'text/plain' olmalıdır.",
    sv: "F�rl�t, dokumentets filtyp ska vara 'text/plain'.",
    pt: "Lamentamos, o formato do documento deve ser 'texto/simples'.",
    en: "Sorry, document's mime type should be 'text/plain'.",
    es: "Lo siento, el media (MIME) type del documento debe ser 'text/plain'.",
    ru: "Пожалуйста, убедитесь, что тип документа — 'text/plain'.",
  },
  'Congratulations! *Voicy* got the credentials file for the *$[1]* Google Cloud Project. Now you are able to use Google Speech recognition.': {
    fa:
      '\u200Fتبریک میگم! وُیسی فایل اعتبار نامه برای پروژه $[1] Google Cloud را دریافت کرد. اکنون شما قادر به استفاده از تشخیص صدای گوگل هستید.',
    hi:
      'बधाई हो! *Voicy* को *$[1]* Google Cloud प्रोजेक्ट के लिए क्रेडेंशियल्स फ़ाइल मिल गई। अब आप Google Speech पहचान का उपयोग कर सकते हैं।',
    et:
      'እንኳን ደስ አለዎት!*Voicy*ለ*$[1]* Google Cloud Project (ጉግል ክላውድ ፕሮጀክት)የሚሆኑ መረጃዎችን አግኝቷል፡፡አሁን Google Speech recognition(የጉግል ንግግር መለያ)አገልግሎትን መጠቀም ይችላሉ፡፡',
    ge:
      'Herzlichen Glückwunsch! *Voicy* hat die Anmeldeinformationen-Datei für das *$[1]* Google-Cloud-Projekt erhalten. Jetzt kannst du die Google-Spracherkennung verwenden.',
    it:
      'Congratulazioni! *Voicy* ha ricevuto il file di credenziali per il progetto Google Cloud *$[1]*. Ora puoi utilizzare il riconoscimento vocale Google Speech.',
    uz:
      'Tabriklaymiz! *Voicy* *$[1]* Google Cloud loyihasi uchun shaxsiy ma�lumotlar faylini oldi. Endi siz Google ovozni tushunish xizmatidan foydalishingiz mumkin.',
    fr:
      'Félicitations! *Voicy* a obtenu le fichier d’informations d’identification pour le *$[1]* projet Google Cloud. Vous êtes maintenant en mesure d’utiliser la reconnaissance vocale de Google Speech.',
    ko:
      '축하합니다! *Voicy*가 *$[1]* 구글 클라우드 프로젝트를 위해 크리덴셜 파일을 얻었습니다. 이제 구글 스피치 인식을 사용할 수 있습니다.',
    ar:
      '\u200Fمبروك صوت حصلت على ملف البينات بقيمة $[1] لمشروع سحابة جوجل , الان بأمكانك إستخدام خدمة التعرف الصوتي من جوجل .',
    az:
      'Təbriklər! “Voicy” *$[1]* Google Speech Layihəsi üçün etibarnamə fayllarını əldə etdi. Artıq Google Speech tanımağından istifadə edə biləcəksiniz.',
    am:
      'Շնորհավորում ենք! *Voicy*-ն ստացավ երաշխավորագրերը *$[1]* Google Cloud ծրագրի համար. Այժմ դուք կարող եք օգտագործել Google Speech ձայնի ճանաչումը։',
    ch:
      '恭喜！*Voicy*已取得*$[1]*Google云端项目的凭证档案。现在，你可以开始使用Google语音辨识了！',
    ua:
      'Вітаємо! * Войсі * отримав файл ідентифікації особи для *$[1]* проекту Google Cloud. Тепер ви можете використовувати розпізнавання мовлення Google.',
    no:
      'Gratulerer! *Voicy* fikk legitimasjonsfilen for *$[1]* Google Cloud Prosjekt. Nå du kan bruke Google talegjenkjenning.',
    ja:
      'よくできました！ *ヴォイシー* は *$[1]* グーグルクラウドプロジェクトの専用ファイルを認識しました。グーグル音声認識が使えるようになりました。',
    tr:
      'Tebrikler! Voicy, *$[1]* Google Cloud Projesi için kimlik bilgileri dosyasını aldı. Artık Google konuşma tanıma özelliğini kullanabilirsiniz.',
    sv:
      'Grattis! *Voicy* fick autentisieringsuppgifterna f�r *$[1]* Google Cloud Project. Du kan nu anv�nda Google taligenk�nning.',
    pt:
      'Parabéns! *Voicy* recebeu o ficheiro das credenciais para o *$[1]* Projeto Google Cloud. Agora pode usar o reconhecimento Google Speech.',
    en:
      'Congratulations! *Voicy* got the credentials file for the *$[1]* Google Cloud Project. Now you are able to use Google Speech recognition.',
    es:
      '¡Felicitaciones! *Voicy* obtuvo el archivo de credenciales para el *$[1]* Proyecto Google Cloud. Ahora usted puede usar el reconocimiento de Google Speech.',
    ru:
      'Поздравляем! *Войси* получил аутентификационный документ для *$[1]* проекта Google Cloud. Теперь вы можете использовать движок Google Speech в этом чате.',
  },
  '😎 *Voicy* converts speech to text from any voice messages and audio files (.ogg, .flac, .wav, .mp3) it receives. You can either talk to *Voicy* in the private chat or add it to a group.\n\nIf you want to use this bot in private messages, please, create a private group with anyone and add *Voicy* there. If you want to add *Voicy* to a group chat, please, add it as a participant on the group profile or to the group in the *Voicy* bot profile.\n\n/help — Shows this message 😱\n/engine — Lets you pick a voice recognition engine: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — Lets you pick a voice recognition language 📣\n/lock — Toggles lock or unlock of non-admins using commands in group chats 🔑\n/files — Toggles if the bot should attempt to convert audio files or just ignore them 📁\n/silent — Toggles silent mode when no extra messages like `Voice recognition is initiated` are sent 😶\n/google — Set up google credentials for Google Speech 🦆\n\nLike this bot? Leave a review [here](https://telegram.me/storebot?start=voicybot) 👍\n\nAddress any concerns and questions to my creator — @borodutch\\_support 🦄': {
    fa:
      '\u200Fوُیسی هر گفتار از پیام و فایل های صوتی (.ogg، .flac، .wav، .mp3) را که دریافت میکند به متن تبدیل می کند. شما می توانید با وُیسی در چت خصوصی صحبت کنید و یا آن را به یک گروه اضافه کنید.\n\n\u200Fاگر می خواهید از این ربات در پیام های خصوصی استفاده کنید، لطفا یک گروه خصوصی با هرکسی بسازید و وُیسی را آنجا اضافه کنید. اگر می خواهید وُیسی را به یک چت گروهی اضافه کنید، لطفا آن را به عنوان مشارکت کننده در پروفایل گروه یا به گروه در پروفایل ربات وُیسی اضافه کنید.\n\n\u200F/help - این پیام را نشان می دهد\n\u200F/engine - اجازه می دهد تا یک موتور تشخیص صدا را انتخاب کنید: wit.ai، Yandex SpeechKit یا Google Speech\n\u200F/language - به شما اجازه می دهد تا یک زبان تشخیص صدا را انتخاب کنید 📣\n\u200F/lock - بین قفل کردن یا بازکردن غیر مدیران با استفاده از دستورات در گروه های چت تغییر وضعیت میدهد 🔑\n\u200F/files - اگر ربات برای تبدیل فایل های صوتی تلاش کند یا فقط آنها را نادیده بگیرد تغییر وضعیت میدهد 📁\n\u200F/silent – هنگامی که هیچ پیام اضافی مانند ‘تشخیص صدا آغاز شده است’ فرستاده میشود به حالت سکوت تغییر وضعیت میدهد 😶\n\u200F/google – اعتبارنامه های گوگل برای گفتار گوگل را تنظیم کنید\n\n\u200Fاین ربات را دوست داشتید؟ نظر خود را [اینجا] بیان کنید (https://telegram.me/storebot?start=voicybot) 👍 \n\n\u200Fهر گونه نگرانی و سوال را به خالق من ارسال کنید - @borodutch\\_support',
    hi:
      "😎 *Voicy* सभी वॉयस मैसेज और ऑडियो फ़ाइलों (.ogg, .flac, .wav, .mp3) से प्राप्त होने वाली आवाज को टेक्स्ट में परिवर्तित करता है। आप निजी बातचीत में भी Voicy से बात कर सकते हैं या इसे किसी ग्रुप में भी जोड़ सकते हैं।\n\nअगर आप निजी संदेश में इस बॉट का उपयोग करना चाहते हैं, तो कृपया किसी के साथ एक निजी समूह बनायें और वहाँ Voicy को जोड़ें। यदि आप किसी ग्रुप चैट में *Voicy* को जोड़ना चाहते हैं, तो कृपया इसे ग्रुप प्रोफ़ाइल पर या *Voicy* बॉट प्रोफाइल में ग्रुप में एक प्रतिभागी के रूप में जोड़ें।\n\n/help - इस मैसेज को दिखाता है 😱\n/engine - आपको कोई वॉयस पहचान इंजन चुनने देता है: wit.ai, Yandex SpeechKit या Google Speech ⚙\n/language - आपको एक वॉयस पहचान भाषा चुनने देता है 📣\n/lock - ग्रुप चैट में कमांड का उपयोग करके नॉन-एडमिन के लॉक या अनलॉक को टॉगल करता है 🔑\n/files - टॉगल करता है कि बॉट को ऑडियो फ़ाइलों को कन्वर्ट करने का प्रयास करना चाहिए या केवल उन्हें अनदेखा करना चाहिए 📁\n/silent - साइलेंट मोड में टॉगल करता है जब 'वॉयस पहचान शुरू की गयी है' जैसे कोई अतिरिक्त मैसेज नहीं भेजे जाते हैं 😶\n/google - Google Speech के लिए Google क्रेडेंशियल सेट करता है 🦆\n\nयह बॉट पसंद आया? एक फीडबैक छोड़ें [यहाँ](https://telegram.me/storebot?start=voicybot) 👍\n\nमेरे निर्माता –– @borodutch\\_support 🦄 पर किसी भी तरह का प्रश्न या परेशानी बताएँ-",
    et:
      '😎 *Voicy*ከእያንዳንዱ የድምጽ መልዕክት ወይም ፋይል (.ogg, .flac, .wav, .mp3) የተቀበላቸውን እያንዳንዱን ንግግር ወደ ጽሁፍ ይቀይራል*Voicy*ን በመጠቀም በግል ወይም በቡድን ምልልስ ሊያደርጉ ይችላሉ.\n\nIf ይህንን ቡት በግል መልዕክት መጠቀም ከፈለጉ እባክዎ የግል የሆነ ቡድን በመመስረት*Voicy*ን ይጨምሩበት*Voicy*ን በቡድን ምልልስ ውስጥ መጨመር ከፈለጉ በቡድኑ ፕሮፋይል ላይ እንደተሳታፊ ይጨምሩት ወይም በቡድኑ ፕሮፋይል*Voicy* bot profile ላይ ይጨምሩት\n\n/help የሚለውን መልዕክት ያሳያል 😱\n/engine —የድምጽ መለያውን ቋንቋ እንዲመርጡ ያደርግዎታል 📣\n/lock —በቡድን ምልልስ ወቅት ትእዛዛትን በመጠቀም መክፈት እና መዝጋት ያስችልዎታል 🔑\n/files —ቡቱ የድምጽ ፋይሎችን ለመቀየር በሚሞክርበት ጊዜ ቁልፋን በመቀያየር ወይም ችላ በማለት ይረዳችኃል 📁\n/silent —ለምሳሌ እንደ `Voice recognition is initiated`(የድምጽ መለየት እንዲጀምር ተደርጓል) የሚሉ አይነት የውጪ መልዕክቶች ሲመጡ ቁልፉን ድምጽ አልባ ያደርገዋል 😶\n/google —ለጉግል የንግግር አገልግሎት መረጃዎችን ያዘጋጃል 🦆\n\nLike this bot?(ይህንን ቡት ወደውታልን?)እባክዎ አስተያትዎትን በሚከተለው ድረ-ገጽ ላይ ያስፍሩ [እዚህ](https://telegram.me/storebot?start=voicybot) 👍\n\nAddress any concerns and questions to my creator — @borodutch\\_support 🦄',
    ge:
      '😎 *Voicy* wandelt von allen erhaltenen Sprachnachrichten und Audio-Dateien (.ogg, .flac, .wav, .mp3) die Sprache zu Text um. Du kannst *Voicy* entweder im direkten Chat nutzen oder ihn oder einer Gruppe hinzufügen.\n\nWenn du diesen Bot in einem privaten Chat verwenden möchtest, erstell bitte eine private Gruppe mit dieser Person und füg *Voicy* hinzu. Wenn du *Voicy* zu einem Gruppenchat hinzufügen möchtest, kannst du *Voicy* von dem Gruppenprofil oder dem Bot-Profil aus als Mitglied hinzufügen.\n\n/help – zeigt diese Meldung 😱\n\n/engine – hier kannst du eine der Spracherkennungs-Engines auswählen: wit.ai, Yandex SpeechKit oder Google Speech ⚙\n/language – damit kannst du die Erkennungssprache auswählen 📣\n/lock – umschalten, ob Nicht-Admins in Gruppen-Chats die Befehle verwenden können 🔑 \n/files – umschalten, ob der Bot versuchen sollte, Audiodateien zu konvertieren, oder sie einfach ignoriert 📁\n/silent – schaltet den Stumm-Modus ein, sodass keine zusätzliche Nachrichten wie „Spracherkennung wird gestartet“ gesendet werden 😶\n/google – Google-Anmeldeinformationen für Google Speech einrichten 🦆\n\n Wie gefällt dir dieser Bot? [Hier](https://telegram.me/storebot?start=voicybot) kannst du eine Bewertung abgeben 👍\n\nSende alle Bedenken und Fragen an meinen Schöpfer – @borodutch\\_support 🦄 ',
    it:
      '😎 *Voicy* converte il parlato in testo di qualsiasi messaggio vocale e file audio (.ogg, .flac, .wav, .mp3) che riceve. Puoi anche parlare a *Voicy* nella chat privata o aggiungerlo in un gruppo. \n\n Se vuoi usare questo programma nei messaggi privati, per cortesia, crea un gruppo privato con chiunque e aggiungi *Voicy*. Se desideri aggiungere *Voicy* in una chat di gruppo, per cortesia, aggiungilo come partecipante sul profilo del gruppo oppure al gruppo nel profilo del programma *Voicy*. \n\n/help – Mostra questo messaggio 😱\n/engine – Ti consente di selezionare un motore di riconoscimento vocale: wit.ai, Yandex SpeechKit o Google Speech ⚙\n/language – Ti consente di selezionare un linguaggio di riconoscimento vocale 📣\n/lock – Attiva lo sblocco o il blocco dell’uso di comandi nelle chat di gruppo da parte di utenti non amministratori 🔑\n/files – Attiva se il programma debba tentare di convertire file audio o semplicemente ignorarli 📁\n/silent – Attiva la modalità silenziosa quando non vengono inviati messaggi extra come “Il riconoscimento vocale è iniziato” 😶\n/google - Configurazione delle credenziali Google per Google Speech 🦆\n\n Ti piace questo programma? Lascia una recensione [qui](https://telegram.me/storebot?start=voicybot) 👍\n\n Invia qualsiasi dubbio o domanda al mio creatore - @borodutch\\_support 🦄 ',
    uz:
      '😎 *Voicy* qabul qilingan har qanday audio fayllar (.ogg, .flac, .wav, .mp3) va ovozli fayllarni matnga aylantiradi. *Voicy*ga maxfiy chatda gapirishingiz yoki uni guruhga qo�shib ham foydalanishingiz mumkin.\n\nBu botdan shaxsiy xabarlar uchun foydalanmoqchi bo�lsangiz, suhbatdoshingiz bilan alohida maxfiy guruh yarating va *Voicy*ni ham shu yerga qo�shing. *Voicy*ni guruh chatiga qo�shmoqchi bo�lsangiz, uni guruh profili orqali ishtirokchi sifatida qo�shing yoki *Voicy* bot profilidagi guruhga qo�shishingiz mumkin.\n\n/help — Bu xabarni ko�rsatadi 😱\n/engine — Ovozni tushunish tizimini tanlang: wit.ai, Yandex SpeechKit yoki Google Speech ⚙\n/language — Ovozni tushunish tilini tanlang 📣\n/lock — Administrator bo�lmaganlar uchun guruh chatlarida buyruqlardan foydalanishga ruxsat beradi yoki taqiqlaydi 🔑\n/files — Bot audio fayllarga aylantirishga uringanda yoki rad qilganda yonadi/o�chadi 📁\n/silent — "Ovozni tushunish ishga tushdi" kabi qo�shimcha xabarlar yuborilmasa, sokin rejimga o�tadi 😶\n/google — Google Speech uchun Google shaxsiy ma�lumotlarini sozlash 🦆\n\nBu bot yoqdimi? Fikr-mulohazalaringizni [bu yerda](https://telegram.me/storebot?start=voicybot) qoldiring 👍\n\nHar qanday muammo yoki savollar bilan meni tuzuvchimga murojaat qiling: — @borodutch\\_support 🦄',
    fr:
      "😎 Il convertit les discours au texte à partir des messages vocaux et des fichiers audio (.ogg, .flac, .wav, .mp3) qu'il reçoit. Vous pouvez soit parler à *Voicy* dans le dans le chat privé ou l'ajouter à un groupe. Si vous souhaitez utiliser ce bot en messages privés, créer un groupe privé avec quelqu'un et ajoutez *Voicy* là.\n\nSi vous souhaitez ajouter *Voicy* à un groupe de discussion, s'il vous plaît, ajoutez-le comme un participant sur le profil du groupe ou au groupe dans le profil bot *Voicy*.\n\n/help — Affiche ce message 😱\n/engine — Vous permet de choisir un moteur de reconnaissance vocale: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — Vous permet de choisir la langue de reconnaissance vocale 📣\n/lock — Bascule verrouiller ou déverrouiller des non-admins à l'aide de commandes dans les groupe de conversations 🔑\n/files — Bascule si le robot doit essayer de convertir des fichiers audio ou simplement les ignorer 📁\n/silent — Bascule le mode silencieux lorsque aucun message supplémentaire comme `La reconnaissance vocale est initiée` est envoyé 😶\n/google — Configurer les informations d'identification de Google pour Google\n\nAime ce bot? Laisser un commentaire ici (https://telegram.me/storebot?start=voicybot)\n\nTraiter des préoccupations et des questions à mon créateur — @borodutch\\_support 🦄",
    ko:
      '😎 *Voicy*는 어떠한 음성 메세지나 음성 파일(.ogg, .flac, .wav, .mp3)도 텍스트로 변환합니다. 당신은 비공개 채팅에서 *Voicy*를 통해 이야기하거나 혹은 그룹 채팅에 *Voicy*를 추가할 수 있습니다.\n\n 개인 채팅에서 이 봇을 사용하기를 원하신다면, 비공개 채팅에 추가하고 싶은 사람을 추가하고 *Voicy*를 추가하세요. 그룹 채팅에 *Voicy*를 추가하고 싶다면, 그룹 프로필 참여자로 *Voicy*를 추가하시거나 *Voicy*봇 프로필 내에서 그룹을 만드세요.\n\n/help — 이 메세지를 보여주세요 😱\n/engine — 음성 인식 엔진을 선택하세요: wit.ai, Yandex SpeechKit 혹은 구글 스피치 ⚙\n/language — 음성 인식 언어를 선택하세요 📣\n/lock — 그룹 채팅 내 비관리자 사용 명령 잠금 또는 잠금 해제 버튼 🔑\n/files — 봇이 음성 파일 변환 시도 혹은 음성 파일 무시 버튼 📁\n/silent — ‘음성 인식이 시작되었습니다’와 같은 메세지가 더 이상 없을 경우 무음 모드 버튼 😶\n/google — 구글 스피치에서 구글 크리덴셜 설정 🦆\n\n이 봇을 좋아하세요? 리뷰를 남겨보세요 [여기를 클릭]( https://telegram.me/storebot?start=voicybot) 👍\n\n 이 봇의 제작자에게 모든 불편사항 혹은 질문을 설명하실 수 있습니다 — @borodutch\\_support 🦄',
    ar:
      '\u200F😎 صوت تحول المحادثات الصوتية إلى كتابة من أي رسالة صوتية او ملف صوتي يتم إستلامه (.ogg, .flac, .wav, .mp3). يمكنك التخاطب مع صوت من خلال دردشة خاصة او مع مجموعة . \u200F\n\n\u200F إذا أردت أستخدام هذا البرنامج في دردشة خاصة .ألرجاء إنشاء دردشة خاصة مع أي شخص و إضافة صوت هناك.إذا اردت إضافة صوتي لأي دردشة جماعية الرجاء إضافته كمشترك في حساب المجموعة او كمشترك في المجموعة على حساب صوت .\u200F\n\n\u200F/help أظهر هذه الرسالة 😱\u200F\n\u200F/engine , يعطك الخيار بين محرك التعرف الصوتي : wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language يعطك الحرية لأختيار لغة التعرف الصوتي 📣\u200F\n\u200F/lock تثبيت او إزالة تثبيت المشرفين من أستعمال الاوامر في الدردشة الجماعية 🔑\u200F\n\u200F/files .تثبيت تحويل البرنامج للملفات الصوتية او تجاهلها 📁\u200F\n\u200F/silent تثبيت وضع الصامت في حالة عدم وجود اي رسائل مرسلة مثل رسائل التعرف الصوتي 😶\u200F\n\u200F/google . إعداد بيانات جوجل لمحادثات جوجل 🦆\u200F\n\n\u200FLike this bot , هل يعجبك هذا البرنامج ؟ الرجاء ترك تقييم (https://telegram.me/storebot?start=voicybot) 👍\u200F\n\n\u200F .هل هنالك أي إستفسار او سؤال للمعدين ؟ @borodutch\\_support 🦄',
    az:
      '😎 *Voicy* qəbul etdiyi hər cür səsli mesajları və audio faylarda (.ogg, .oflac, .wav, .mp3) olan danışıqları yazılı formata çevirir. “Voicy” ilə şəxsi söhbət otağında danışa, yaxud qrupa əlavə edə bilərsiniz. \n\nƏgər bu botdan şəxsi mesajlarda istifadə etmək istəyirsinizsə, zəhmət olmasa, kimləsə şəxsi qrup söhbəti açın və *Voicy*ni ora əlavə edin. Əgər *Voicy*ni qrup söhbətinə əlavə etmək istəyirsinizsə, zəhmət olmasa, onu qrup üzvü kimi daxil edin, yaxud qrupla *Voicy* bot profilinə yığışın.\n\n/help – Bu mesajı göstərir 😱\n/engine – Gəlin, sizin üçün səs tanıma mühərriki seçək: wit.ai, Yandex SpeechKit yaxud Google Speech. ⚙\n/language – Gəlin, sizin üçün səs tanıması dili seçək 📣\n/lock - adminlərin qrup söhbət otaqlarında əmr verməyini kilidləmə və ya açma çubuğu 🔑\n/files – Bot audio faylları çevirməyə cəhd eləməlidir və ya görməməzlikdən gəlməlidir çubuğu 📁\n/silent – “Səs tanıması başladılmışdır” kimi əlavə mesajlar göndərilmədiyi səssiz rejimə keçmə çubuğu 😶\n/google – Google Speech üçün google etibarnamələrini quraşdırın 🦆\n\nBot xoşunuza gəlirmi? Rəy bildirin [bura](https://telegram.me/storebot?start=voicybot) 👍\n\nHər cür narahatlıq və suallarınızı yaradıcıma ünvanlayın - @borodutch\\_support',
    am:
      '😎 *Voicy*-ին ցանկացած ձայնային հաղորդագրությունից և աուդիոֆայլից ստացված խոսքը վերածում է տեքստի (.ogg, .flac, .wav, .mp3). Դուք կարող եք խոսել *Voicy*-ի հետ ինչպես անձնական չատում, այնպես էլ ավելացնեք նրան խմբակային չատին.\n\nեթե դուք ցանկանում եք օգտագործել այս բոտը(ռոբոտ ծրագիրը) անձնական հաղորդագրության մեջ, ստեղծեք անձնական խումբ ինչ-որ մեկի հետ և ավելացրեք այդտեղ *Voicy*-ն. Եթե ցանկանում եք *Voicy*-ն ավելացնել խմբակային չատում, ավելացրեք նրան խմբի պրոֆիլին որպես մասնակից, կամ *Voicy*-ի բոտի պրոֆիլի խմբում.\n\n/help — Ցույց է տալիս այս նամակը \n/engine — Հնարավորություն է տալիս ձեզ ընտրելու ձայնի ճանաչման միջոցը․wit.ai, Yandex SpeechKit կամ Google Speech ⚙\n/language — Հնարավորություն է տալիս ձեզ ընտրելու ձայնի ճանաչման լեզուն 📣\n/lock — ընտրել բացել կամ արգելափակել ոչ-ադմիններին՝ օգտագործելով խմբակային չատերի հրահանգները 🔑\n/files — ընտրել արդյոք բոտը պետք է փորձի վերափոխել աուդիոֆայլերը, կամ, ուղղակի, անտեսի դրանք 📁\n/silent — ընտրել անձայն ռեժիմ, երբ, ոչ մի նմանատիպ `Սկսվել է ձայնի ճանաչումը` լրացուցիչ հաղորդագրություններ չեն ուղարկվել 😶\n/google — Տեղադրել google երաշխավորագրեր Google Speech-ի համար 🦆\n\nՀավանեցիր այս բոտը? թող քո կարծիքը [այստեղ](https://telegram.me/storebot?start=voicybot)👍\n\n Մտահոգությունների կամ հարցերի դեպքում դիմել հեղինակին - @borodutch\\_support 🦄',
    ch:
      '😎 *Voicy*会把收到的所有语音讯息及语音档（.ogg、.flac、.wav及.mp3）转换成文字。您可在私人对话中使用*Voicy*，也可以把软体加到群组对话。\n\n如果您希望在私人对话中使用这个软体，请与您的对话对象设立一个对话群组，然后把*Voicy*加入该群组。如果您希望把*Voicy*加入群组对话，请在群组档案中加入该软体，或在*Voicy*的软体档案中，把软体加群组内。\n\n/help — 展示这个讯息😱\n/engine — 让您选择语音辨识软体：wit.ai、Yandex SpeechKit或Google Speech ⚙\n/language — 让您选择需要语言辨识的语言📣\n/lock — 封锁或容许管理员以外的人士在群组对话中使用命令🔑\n/files — 指令软体尝试转换语音档案或无视它们📁\n/silent —除非出现类似`语音辨识已启动`的讯息，否则切换至静音模式😶\n/google — 设立Google Speech的云端凭证档案🦆\n\n您喜欢这个软体吗？请[在这里]为我们留下评语吧(https://telegram.me/storebot?start=voicybot) 👍\n\n如果您有任何意见或问题，请与我的设计者联络吧！ — @borodutch\\_support 🦄',
    ua:
      '😎 *Войсі* перетворює мову в текст із будь-яких голосових повідомлень та аудіофайлів (.ogg, .flac, .wav, .mp3), які він отримує. Ви можете використовувати *Войсі* в приватному чаті або додати його до групових чатів.\n\nЯкщо ви хочете використовувати його у приватних повідомленнях, будь-ласка, створіть приватну групу з будь-ким і додайте туди *Войсі*. Якщо ви хочете додати *Войсі* до групового чату, будь-ласка, додайте його як учасника у профілі групи або у профілі *Войсі*.\n\n/help - Показує це повідомлення 😱\n/engine - Дозволяє обрати інструмент розпізнавання голосу: wit.ai, Yandex SpeechKit або Google Speech ⚙\n/language - дозволяє вибирати мову розпізнавання голосу 📣\n/lock - Блокування або розблокування команд, які надсилають не адміністратори у групових чатах 🔑\n/files – Включення або вимкнення конвертування аудіофайлів 📁\n/silent - Включення режиму тиші, окрім додаткових повідомлень типу "Розпізнавання голосу" 😶\n/google - Налаштування ідентифікації особи Google мовлення 🦆\n\nПодобається цей бот? Залишіть відгук [тут] (https://telegram.me/storebot?start=voicybot) 👍\n\nБудь-які питання та пропозиції надсилайте автору - @borodutch\\_support 🦄',
    no:
      '😎 *Voicy* konverterer tale til tekst fra alle talemeldinger og lydfiler (.ogg, .flac, .wav, .mp3) den mottar. Du kan enten prata med *Voicy* i private chat eller tilføj det til en gruppe.\n\nHvis du vil bruke dette bot i private meldinger, vennligst opprett en privat gruppe med noen og legg *Voicy* til der. Hvis du vil legge *Voicy* til gruppechat, vennligst, legg det til som deltaker i gruppeprofilen eller til gruppen i *Voicy* bot profil.\n\n/help — Viser denne meldingen 😱\n/engine — Lar deg velge en talegjenkjenningsmotor: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — Lar deg velge et talegjenkjenning språk 📣\n/lock — Bytter lås eller opplås for ikke-administratorer ved hjelp av kommandoer i gruppechat. 🔑\n/files — bytter hvis botet skulle forsøke å konvertere lydfiler eller bare ignorere dem. 📁\n/silent — Bytter stillemodus når ingen ekstra meldinger som `Talegjenkjenning er initiert` sendes 😶\n/google — Oppsett google legitimasjon for Google Speech 🦆\n\nLiker deg dette bot? Legg igjen en anmeldelse [her](https://telegram.me/storebot?start=voicybot) 👍\n\nAdresse eventuelle bekymringer og spørsmål til min skaperen — @borodutch\\_support 🦄',
    ja:
      '😎 *ヴォイシー* はどんな音声ファイル (.ogg, .flac, .wav, .mp3) やボイスメッセージからも文字をおこすことができます。 *ヴォイシー* と個人ででも、グループチャットでも話せます。\n\nもしこのボットをプライベートチャットで利用したいなら、誰かとプライベートグループを作成し、そこに*ヴォイシー*を追加してあげてください。 *ヴォイシー* をグループチャットに追加たい場合、参加者として追加するか、 *ヴォイシー* のプロフィールにあるグループを選択してください。\n\n/help — これを表示する 😱\n/engine — 音声認識エンジンを選択させてくれる: wit.ai, Yandex SpeechKit か Google Speech ⚙\n/language — 音声認識の言語を選択させてくれる。 📣\n/lock — グループチャットの主催者のコマンドをロック、解除する 🔑\n/files — ボットが音声ファイルを変換するかしないか 📁\n/silent — `音声認識が始まりました` などの追加メッセージがない限りサイレントモードになる 😶\n/google — グーグルスピーチのためグーグル資格情報を設定する 🦆\n\nこのボット、気に入りましたか? レビューをお願いします。[こちら](https://telegram.me/storebot?start=voicybot) 👍\n\nお困りでしたら、創設者にひとこと — @borodutch\\_support 🦄',
    tr:
      '😎 *Voicy*, aldığı tüm sesli mesajlardan ve ses dosyalarından (.ogg, .flac, .wav, .mp3) gelen konuşmaları metne dönüştürür. Özel sohbette Voicy ile konuşabilir veya bir gruba ekleyebilirsiniz.\n\nBu botu özel mesajlarda kullanmak istiyorsanız, lütfen biriyle özel bir grup oluşturun ve buraya *Voicy* ekleyin. Bir grup sohbetine *Voicy* eklemek istiyorsanız, lütfen onu grup profiline katılımcı olarak ekleyin ya da *Voicy* bot profilindeki gruba ekleyin.\n\n/help — Bu mesajı gösterir 😱\n/engine — Bir ses tanıma motoru seçmenizi sağlar: wit.ai, Yandex SpeechKit ya da Google Speech ⚙\n/language — Bir ses tanıma dili seçmenizi sağlar 📣\n/lock — Grup sohbetlerinde komutları kullanarak yönetici olmayanların kilidini açın veya kapatın 🔑\n/files — Botun ses dosyalarını dönüştürmeye çalışması ya da onları görmezden gelmesi seçeneğini değiştirin  📁\n/silent — `Ses tanıma başlatıldı` gibi ek bir mesaj gönderilmediğinde sessiz moda geçer 😶\n/google — Google Speech için Google kimlik bilgilerini ayarlayın 🦆\n\nBu botu beğendiniz mi? Lütfen, [buraya](https://telegram.me/storebot?start=voicybot) bir inceleme bırakın 👍\n\nHerhangi bir kaygı ve sorununuzu geliştiricimle paylaşın — @borodutch\\_support 🦄',
    sv:
      '😎 *Voicy* konverterar tal till text fr�n alla typer av r�stmeddelanden och ljudfiler (.ogg, .flac, .wav, .mp3) den tar emot. Du kan antingen prata med *Voicy* i den privata chatten eller l�gga till den i en grupp.\n\nOm du vill anv�nda denna bot i privata meddelanden, var god skapa en privat grupp med alla och l�gg till *Voicy* d�r. Om du vill l�gga till *Voicy* till en gruppchatt, var god, l�gg till den som en deltagare i grupprofilen eller till gruppen i *Voicy* bot profil.\n\n/help — Visar det h�r meddelandet 😱\n/engine — L�ter dig v�lja en leverant�r f�r r�stigenk�nning: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — L�ter dig v�lja spr�k f�r r�stigenk�nning 📣\n/lock — Reglaget l�ser upp eller l�ser m�jligheten f�r icke- administrat�rer att anv�nda kommandon i gruppchatter 🔑\n/files — Reglaget reglerar om boten ska f�rs�ka konvertera ljudfiler eller bara ignorera dem 📁\n/silent — V�lj ljudl�s n�r inga extra meddelanden som `R�stigenk�nning �r initierad` �nskas 😶\n/google — St�ll in google autentisieringsuppgifter Google Speech 🦆\n\nGillar denna bot? L�mna ett omd�mme [here](https://telegram.me/storebot?start=voicybot) 👍\n\nOm du har fr�goer eller funderingar skickas dessa till botens skapare — @borodutch\\_support 🦄',
    pt:
      '😎 *Voicy* converte áudio em texto, a partir de qualquer mensagem ou ficheiro de áudio (.ogg, .flac, .wav, .mp3) que receba. Pode falar para o *Voicy* no chat privado ou num grupo.\n\nSe deseja usar este bot em mensagens privadas, por favor crie um grupo privado com alguém e adicione o *Voicy*. Se deseja adicionar *Voicy* a uma conversa de grupo, por favor adicione-o como um participante no perfil do grupo ou no perfil do bot *Voicy*.\n\n/help — Exibe esta mensagem 😱\n/engine — Permite selecionar um motor de reconhecimento de voz: wit.ai, Yandex SpeechKit ou Google Speech ⚙\n/language — Permite selecionar o idioma para reconhecimento de voz 📣\n/lock — Bloqueia ou desbloqueia comandos nos chats de grupo para não-administradores 🔑\n/files — Indique se o bot deve tentar converter ficheiros áudio ou ignorá-los 📁\n/silent — Ative o modo silencioso quando mensagens como `Reconhecimento de Voz Iniciado` são enviadas 😶\n/google — Configure as credenciais para o Google Speech 🦆\n\nGosta deste bot? Avalie [aqui](https://telegram.me/storebot?start=voicybot) 👍\n\nDeixe qualquer sugestão ou questão ao meu programador — @borodutch\\_support 🦄',
    en:
      '😎 *Voicy* converts speech to text from any voice messages and audio files (.ogg, .flac, .wav, .mp3) it receives. You can either talk to *Voicy* in the private chat or add it to a group.\n\nIf you want to use this bot in private messages, please, create a private group with anyone and add *Voicy* there. If you want to add *Voicy* to a group chat, please, add it as a participant on the group profile or to the group in the *Voicy* bot profile.\n\n/help — Shows this message 😱\n/engine — Lets you pick a voice recognition engine: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — Lets you pick a voice recognition language 📣\n/lock — Toggles lock or unlock of non-admins using commands in group chats 🔑\n/files — Toggles if the bot should attempt to convert audio files or just ignore them 📁\n/silent — Toggles silent mode when no extra messages like `Voice recognition is initiated` are sent 😶\n/google — Set up google credentials for Google Speech 🦆\n\nLike this bot? Leave a review [here](https://telegram.me/storebot?start=voicybot) 👍\n\nAddress any concerns and questions to my creator — @borodutch\\_support 🦄',
    es:
      '😎 *Voicy* convierte voz a texto desde cualquier mensaje de voz y archivo de audio (.ogg, .flac, .wav, .mp3) que reciba. Usted puede tanto hablarle a *Voicy* en el chat privado o agregarlo a un grupo.\n\nSi usted desea usar este bot en mensajes privados, por favor, cree un grupo privado con cualquiera y agregue allí a *Voicy*. Si usted desea agregar a *Voicy* a un chat grupal, por favor, agréguelo como un participante en el perfil del grupo o desde el perfil del bot *Voicy*.\n\n/help — Muestra este mensaje 😱\n/engine — Le permite escoger un motor de reconocimiento de voz: wit.ai, Yandex SpeechKit or Google Speech ⚙\n/language — Le permite escoger el idioma de reconocimiento de voz 📣\n/lock — Alterna entre el bloqueo y desbloqueo de los no-administradores usando comandos en los chats grupales 🔑\n/files — Alterna entre si el bot debe intentar convertir archivos de audio o solo ignorarlos 📁\n/silent — Alterna al modo silencio cuando se envían mensajes extras como `Reconocimiento de voz iniciado` 😶\n/google — Establezca credenciales google para Google Speech 🦆\n\nLe gusta este bot? Deje una reseña [aquí](https://telegram.me/storebot?start=voicybot) 👍\n\nRefiera cualquier asunto o pregunta a mi creador — @borodutch\\_support 🦄',
    ru:
      '😎 *Войси* переводит в текст все голосовые сообщения и аудио файлы (.ogg, .flac, .wav, .mp3), которые получает. Вы можете использовать *Войси* в личных сообщениях или добавить его в группу.\n\nЕсли вы хотите использовать *Войси* в приватных сообщениях с другими людьми, то, пожалуйста, создайте приватную группу с собеседником и добавьте туда *Войси*. Если хотите добавить *Войси* в групповой чат, то, пожалуйста, добавьте его, как собеседника в профиле группы, или в профиле *Войси*.\n\n/help — Это сообщение 😱\n/engine — Выбор движка распознавания речи: wit.ai, Yandex SpeechKit или Google Speech ⚙\n/language — Выбор языка распознавания речи 📣\n/lock — Включает и выключает обработку команд, отправленных не админами в групповых чатах 🔑\n/files — Включает и выключает обработку аудио файлов 📁\n/silent — Включает и выключает тихий режим, когда *Войси* не посылает лишних сообщений типа `Распознавание речи инициированно` 😶\n/google — Установка аутентификационного файла для использования движка Google Speech 🦆\n\nХотите поддержать автора бота? Подпишитесь на его канал — [@golden_borodutch](https://t.me/golden_borodutch) 👍\n\nВсе вопросы и пожелания по боту отправляйте напрямую создателю — @borodutch\\_support 🦄',
  },
  '😅 Sorry, but this command only works in group chats.': {
    fa: '\u200F😅 متاسفم، اما این دستور فقط در چت گروهی کار می کند.',
    hi: '😅 क्षमा करें, लेकिन यह कमांड केवल ग्रुप चैट के लिए ही है।',
    et: '😅 ይቅርታ፡ይህ ትዕዛዝ የሚሰራው በቡድን ምልልስ ብቻ ነው፡፡',
    ge:
      '😅 Tut mir leid, aber dieser Befehl funktioniert nur in Gruppen-Chats.',
    it:
      '😅 Spiacente ma questo comando funziona solamente nelle chat di gruppo.',
    uz: '😅 Uzr, bu buyruq faqatgina guruh chatlarida ishlaydi.',
    fr:
      '😅 Désolé, mais cette commande ne fonctionne que dans le groupe de discussion.',
    ko: '😅 죄송합니다, 이 명령은 그룹 채팅에서만 작동합니다.',
    ar: '\u200F😅 عذراً , هذا الخيار يعمل فقط في الدردشة الجماعية .',
    az: '😅 Bağışlayın, bu əmr ancaq qrup söhbətlərində işləyir.',
    am:
      '😅 Ներողություն, բայց այս հրահանգը գործում է միայն խմբակային չատերում.',
    ch: '😅 抱歉！这项指令只适用于群组对话。',
    ua: '😅 Вибачте, але ця команда діє тільки для групових чатів.',
    no: '😅 Beklager, men denne kommandoen fungerer kun i gruppechatt.',
    ja: '😅 ごめんなさい、このコマンドはグループチャットでしか使えません。',
    tr: '😅 Üzgünüm, ama bu komut sadece grup sohbetlerinde çalışır.',
    sv: '😅 Detta kommandot fungerar tyv�rr bara i gruppchatter.',
    pt: '😅 Lamento, mas este comando só funciona em chats de grupo.',
    en: '😅 Sorry, but this command only works in group chats.',
    es: '😅 Lo siento, pero este comando solo funciona en chat grupales.',
    ru: '😅 Простите, эта команда работает только в групповых чатах.',
  },
  '🔑 Great! *Voicy* will now respond only to command calls sent by *admins* in this chat.': {
    fa:
      '\u200F🔑 خیلی خوب! وُیسی اکنون تنها به تماسهای دستوری ارسال شده توسط ادمین ها در این چت واکنش خواهد داد.',
    hi:
      '🔑 बहुत बढ़िया! *Voicy* अब इस चैट में एडमिन द्वारा भेजे गए कमांड कॉल का ही जवाब देगा।',
    et:
      '🔑 ድንቅ! *Voicy* አሁን ምላሽ የሚሰጠው በዚህ ምልልስ ውስጥ ላሉ*admins* የትዕዛዝ ጥሪዎች ብቻ ነው፡፡',
    ge:
      '🔑 Wunderbar! *Voicy* reagiert in diesem Chat nun nur noch auf Befehle, die von einem *Administrator* gesendet werden.',
    it:
      '🔑 Ottimo! *Voicy* risponderà ora solo ai comandi inviati dagli *amministratori* in questa chat.',
    uz:
      '🔑 Zo�r! *Voicy* bu chatda faqat *admins* (administratorlar) yuborgan buyruq chaqiruvlariga javob beradi.',
    fr:
      '🔑 Parfait! *Voicy* répondra désormais uniquement aux appels de commande envoyés par *admins*dans ce chat.',
    ko:
      '🔑 좋아요! *Voicy*는 이제 이 채팅의 *관리자*에 의한 명령에만 응답합니다.',
    ar:
      '\u200F🔑 رائع صوت الأن سيتم الأستجابة فقط للأوامر المرسلة من المشرفين على هذه الدردشة .',
    az:
      '🔑 Əla! Bundan sonra *Voicy* bu söhbətdə ancaq *adminlər* tərəfindən göndərilən əmr çağırışlarına cavab verəcək.',
    am:
      '🔑 Գերազանց է! *Voicy*-ն այսուհետ կպատասխանի միայն հրահանգ-զանգերին՝այս չատի *ադմինների* կողմից ուղարկված. ',
    ch: '🔑 很好！从现在起，*Voicy*只会回应本对话中的*admins*的指令。',
    ua:
      '🔑 Чудово! Відтепер *Войсі* реагуватиме лише на команди, відправлені *адміністраторами* у цьому чаті.',
    no:
      '🔑 Flott! *Voicy* skal nå svare kun på kommandoer som sendes av *admins* i denne chatten.',
    ja: '🔑 了解！ *ヴォイシー* は *主催者* のコマンドにしか応じないよ。',
    tr:
      '🔑 Harika! *Voicy* artık sadece bu sohbetteki *yöneticiler* tarafından gönderilen komut çağrılarına cevap verecektir.',
    sv:
      '🔑 Bra! *Voicy* kommer nu bara svara p� kommandon skickade av *administrat�rer* i den h�r chatten.',
    pt:
      '🔑 Boa! Agora, *Voicy* só vai responder a comandos enviados por *administradores* neste chat.',
    en:
      '🔑 Great! *Voicy* will now respond only to command calls sent by *admins* in this chat.',
    es:
      '🔑 ¡Estupendo! *Voicy* responderá ahora solo a los comandos enviados por *administradores* en este chat.',
    ru:
      '🔑 Отлично! *Войси* теперь будет реагировать только на команды, посланные *админами* в этом чате.',
  },
  '🔑 Great! *Voicy* will now respond only to command calls from *anyone* in this chat.': {
    fa:
      '\u200F🔑 خیلی خوب! وُیسی اکنون تنها به تماسهای دستوری ارسال شده توسط هر شخصی در این چت واکنش خواهد داد.',
    hi:
      '🔑 बहुत बढ़िया! *Voicy* अब इस चैट में किसी के भी कमांड कॉल का जवाब देगा।',
    et: '🔑 ድንቅ ! *Voicy* አሁን ምላሽ የሚሰጠው በዚህ ምልልስ ውስጥ ላሉ *ለማንኛቸውም *ነው፡፡',
    ge:
      '🔑 Wunderbar! *Voicy* reagiert nun auf Befehle von *jedem* in diesem Chat.',
    it:
      '🔑 Ottimo! *Voicy* risponderà ora solo ai comandi inviati da *chiunque* in questa chat.',
    uz:
      '🔑 Zo�r! *Voicy* bu chatda faqat *anyone* (har qanday inson) yuborgan buyruq chaqiruvlariga javob beradi.',
    fr:
      '🔑 Parfait! *Voicy* répondra désormais uniquement aux appels de commande envoyés par *personne* dans ce chat.',
    ko:
      '🔑 좋아요! *Voicy*는 이제 이 채팅의 *모든 사람*에 의한 명령에 응답합니다.',
    ar:
      '\u200F🔑 رائع صوت الأن سيتم الاستجابة للأوامرالمرسلة من الجميع على هذه الدردشة .',
    az:
      '🔑 Əla! Bundan sonra *Voicy* bu söhbətdə ancaq *hərkəs* tərəfindən göndərilən əmr çağırışlarına cavab verəcək.',
    am:
      '🔑 Գերազանց է! *Voicy*-ն այսուհետ կպատասխանի միայն հրահանգ-զանգերին՝ այս չատում *յուրաքանչյուրի* կողմից ուղարկված. ',
    ch: '🔑 很好！从现在起，*Voicy*只会回应本对话中的*anyone*的指令。',
    ua:
      '🔑 Чудово! Відтепер *Войсі* реагуватиме лише на команди від *будь-кого* у цьому чаті.',
    no:
      '🔑 Flott! *Voicy* skal nå svare kun på kommandoer som sendes av *noen som helst* i denne chatten.',
    ja: '🔑 了解! *ヴォイシー* は *みなさん* のコマンドに応じるよ。',
    tr:
      '🔑 Harika! *Voicy* artık bu sohbetteki *herkesin* gönderdiği komut çağrılarına cevap verecektir.',
    sv:
      '🔑 Bra! *Voicy* kommer nu svara endast p� samtal fr�n *alla* i den h�r cahtten.',
    pt:
      '🔑 Boa! Agora, *Voicy* vai responder a comandos de *qualquer pessoa* neste chat.',
    en:
      '🔑 Great! *Voicy* will now respond only to command calls from *anyone* in this chat.',
    es:
      '🔑 ¡Estupendo! *Voicy* responderá ahora a los comandos de *cualquiera* en este chat.',
    ru:
      '🔑 Отлично! *Войси* теперь будет реагировать на команды, посланные *кем угодно* в этом чате.',
  },
  '😶 Magnificent! *Voicy* will now work in *silent mode*: it will not send any messages to the chat except for the actual voice transcriptions.': {
    fa:
      '\u200F😶 عالی! وُیسی در حال حاضر در حالت سکوت کار می کند: هیچ پیامی به غیر از رونویسی صوتی به چت ارسال نمی کند.',
    hi:
      '😶 अद्भुत! *Voicy* अब साइलेंट मोड में काम करेगा: यह वास्तविक आवाज नकल को छोड़कर चैट में कोई मैसेज नहीं भेजेगा।',
    et:
      '😶 ግሩም! *Voicy* አሁን በ*silent mode*ይሰራል፡የድምጹን ቀጥተኛ ትርጓሜ ካልሆነ መልዕክት አያስተላልፍም፡፡',
    ge:
      '😶 Großartig! *Voicy* funktioniert jetzt im *Stumm-Modus*: Er sendet keine Nachrichten in den Chat mit Ausnahme der tatsächlichen Stimm-Transkriptionen.',
    it:
      '😶 Magnifico! *Voicy* funzionerà ora in *modalità silenziosa*: non invierà alcun messaggio eccetto le effettive trascrizioni vocali.',
    uz:
      '😶 Qoyil! *Voicy* endi *silent mode* (sokin rejim)da ham ishlaydi: u endi chatga amaldagi ovoz transkripsiyasidan boshqa hech qanday xabar yubormaydi.',
    fr:
      "😶 Magnifique! *Voicy* fonctionne désormais en *mode silencieux*: il n'enverra pas aucun message sur le chat sauf les messages pour les transcriptions de voix réelles.",
    ko:
      '😶 훌륭해요! *Voicy*는 이제 *무음 모드*를 동작합니다: 실제 음성 기록을 제외한 어떠한 메세지도 보내지 않습니다.',
    ar:
      '\u200F😶 عظيم! صوت سيتم العمل الان من خلال الوضع الصامت: لن يتم إرسال أي رسائل للدردشة ما عدا المدونات الصوتية .',
    az:
      '😶 Şəhanə! Bundan sonra *Voicy* *səssiz rejim*də işləyəcək: əsl səs yazıköçürmələrindən başqa söhbətə heç bir mesaj göndərməyəcək.',
    am:
      '😶 Հոյակա՜պ է։ *Voicy*-ն այսուհետ կաշխատի *անձայն ռեժիմով*։ Նա այլևս չի ուղարկի որևէ նամակ չատին բացառությամբ փաստացի ձայնային տառադարձությունները։',
    ch:
      '😶 太棒了！从现在起，您可在*silent mode*中使用*Voicy*：除了语音输入外，它不会传送任何信息。',
    ua:
      '😶 Чудово! Відтепер *Войсі* працюватиме в *режимі тиші*: він не надсилатиме повідомлення в чат, окрім фактичних голосових транскрипцій.',
    no:
      '😶 Storslått! *Voicy* skal nå fungere i *stille modus*: det skal ikke sende meldinger til chatten bortsett fra faktiske stemme transkripsjonene.',
    ja:
      '😶 いいねぇ！ *ヴォイシー* はこれから *サイレントモード*: 音声テキスト以外は送信しないよ。',
    tr:
      '😶 Muhteşem! *Voicy* artık *sessiz modda* çalışacak: Gerçek sesli transkripsiyonlar haricinde sohbete herhangi bir mesaj göndermez.',
    sv:
      '😶 Fantastiskt! *Voicy* kommer nu vara i *tyst l�ge*: den kommer inte s�nda n�gra meddelanden till chatten f�rutom de faktiska r�st transkriptionerna.',
    pt:
      '😶 Ótimo! *Voicy* vai funcionar no *modo silêncio*: não vai enviar mensagens para o chat, exceto para transcrições de voz.',
    en:
      '😶 Magnificent! *Voicy* will now work in *silent mode*: it will not send any messages to the chat except for the actual voice transcriptions.',
    es:
      '😶 ¡Magnífico! *Voicy* trabajará ahora en *modo silencio*: no enviará ningún mensaje al chat excepto por las transcripciones de voz.',
    ru:
      '😶 Магически! *Войси* теперь работает в *тихом режиме*: он не будет посылать в чат ничего, кроме распознанного текста.',
  },
  '😏 Magnificent! *Voicy* will now work in *usual mode*: it will send `Voice recognition is initiated` messages right after it receives voice messages.': {
    fa:
      '\u200F😏 عالی! وُیسی در حال حاضر در حالت معمولی کار می کند: پیام ‘تشخیص صدا آغاز شده است’ را درست پس از دریافت پیام های صوتی ارسال می کند.',
    hi:
      "😏 अद्भुत! *Voicy* अब सामान्य मोड में काम करेगा: यह वॉयस मैसेज प्राप्त करने के तुरंत बाद 'आवाज की पहचान शुरू की गई है' मैसेज भेज देगा।",
    et:
      '😏 ግሩም! *Voicy* አሁን በ*usual mode*ይሰራል፡የድምጽ መልዕክቶቹን እንደተቀበለ ወዲያውኑ `Voice recognition is initiated` (የድምጽ መለየት አገልግሎት ተጀምሯል) የሚል መልዕክት ያስተላልፋል፡፡',
    ge:
      '😏 Prächtig! *Voicy* funktioniert jetzt im *normalen Modus*: Er sendet „Spracherkennung wird gestartet“-Nachrichten, direkt nachdem eine Sprachnachrichte empfangen wurde.',
    it:
      '😏 Magnifico! *Voicy* funzionerà ora in *modalità normale*: invierà i messaggi ‘Il riconoscimento vocale è iniziato’ subito dopo aver ricevuto i messaggi vocali. ',
    uz:
      '😏 Qoyil! *Voicy* endi *usual mode* (odatdagi rejim)da ishlaydi: u audio xabarlarni olganidan keyin "Ovozni tushunish ishga tushdi" xabarini yuboradi.',
    fr:
      '😏 Magnifique! *Voicy* fonctionne désormais en *mode normal*: il enverra des messages `La reconnaissance vocale est initiée` juste après la réception de messages vocaux.',
    ko:
      '😏 훌륭해요! *Voicy*는 이제 *일반 모드*를 동작합니다: 음성 메세지를 받은 직후에 ‘음성 인식이 시작되었습니다’ 메세지를 보냅니다.',
    ar:
      '\u200F😏عظيم! صوت سيتم العمل الان من خلال الوضع العام: سوف يتم إرسال رسائل التعرف الصوتي فوراً عند إستلام رسائل صوتية .',
    az:
      '😏 Şəhanə! Bundan sonra *Voicy* *adi rejim*də işləyəcək : səs qəbul edən kimi “Səs tanıması başladılmışdır” mesajı göndərəcək.',
    am:
      '😏 Հոյակա՜պ է։ *Voicy*-ն այսուհետ կաշխատի *սովորական ռեժիմով*: Նա կուղարկի `Սկսվել է ձայնի ճանաչումը` նամակը անմիջապես ձայնային հաղորդագրություն ստանալուց հետո։',
    ch:
      '😏 太棒了！从现在起，您可在*usual mode*中使用*Voicy*：在收到语音讯息后，它会发送`语音辨识已启动`的讯息。',
    ua:
      '😏 Чудово! Відтепер *Войсі* працюватиме в *звичайному режимі*: він надсилатиме повідомлення `Розпізнавання голосу` одразу після отримання голосових повідомлень.',
    no:
      '😏 Storslått! *Voicy* skal nå fungere i *vanlig modus*: det skal sende `Talegjenkjenning er initiert` meldinger rett etter at det mottar talemeldinger.',
    ja:
      '😏 いいねぇ！ *ヴォイシー* は *通常モード*:ボイスメッセージを受信たときに `音声認識を開始しました` と言うよ。',
    tr:
      '😏 Muhteşem! *Voicy* artık *normal modda* çalışacaktır:  Sesli mesajlar aldıktan hemen sonra `Ses tanıma başlatıldı` mesajlarını gönderecektir.',
    sv:
      '😏 Fantastiskt! *Voicy* kommer nu fungera i *normalt l�ge*: den kommer skicka `R�stigenk�nning �r initierad` meddelanden direkt efter att den tar emot r�stmeddelanden.',
    pt:
      '😏 Fantástico! *Voicy* vai trabalhar no *modo normal*: vai enviar mensagens `Reconhecimento de Voz Iniciado` depois de receber mensagens de voz.',
    en:
      '😏 Magnificent! *Voicy* will now work in *usual mode*: it will send `Voice recognition is initiated` messages right after it receives voice messages.',
    es:
      '😏 ¡Magnífico! *Voicy* trabajará ahora en *modo usual*: enviará mensajes de `Reconocimiento de voz iniciado` justo después de recibir mensajes de voz.',
    ru:
      '😏 Магически! *Войси* теперь работает в *обычном режиме*: он будет посылать сообщения типа `Распознавание голоса инициированно` сразу после получения голосовых сообщений.',
  },
  "👋 Hello there! *Voicy* is a voice recognition bot that converts all voice messages and audio files (.ogg, .flac, .wav, .mp3) it gets into text.\n\n*Voicy* supports three voice recognition engines: wit.ai, Yandex SpeechKit and Google Speech. Initially it's set to use wit.ai but you can switch to Google Speech or Yandex SpeechKit anytime in /engine. More information in /help.": {
    fa:
      '\u200F👋 درود بر شما! وُیسی یک ربات تشخیص صدا است که تمام پیام ها و فایل های صوتی (ogg, .flac, .wav, .mp3.) را به متن تبدیل می کند.\n\n\u200Fوُیسی از سه موتور تشخیص صدا پشتیبانی می کند: wit.ai ، Yandex SpeechKit و گفتار گوگل. ابتدا تنظیم شده است که از wit.ai استفاده کند اما میتوانید در هر زمان آن را در /engine به Google Speech یا Yandex SpeechKit تغییر دهید. اطلاعات بیشتر در /help.',
    hi:
      '👋 नमस्ते! *Voicy* आवाज की पहचान करने वाला एक स्वचालित प्रोग्राम (बॉट) है जो सभी वॉयस मैसेज और ऑडियो फ़ाइलों (.ogg, .flac, .wav, .mp3) को टेक्स्ट में परिवर्तित करता है।\n\n*Voicy* तीन आवाज की पहचान करने वाले इंजन को सपोर्ट करता है: wit.ai, Yandex SpeechKit और Google Speech। सबसे पहले यह wit.ai का उपयोग करने के लिए सेट किया गया है लेकिन आप किसी भी समय इसे इंजन में Google Speech या Yandex SpeechKit में बदल सकते हैं। अधिक जानकारी /engine में है।',
    et:
      '👋 ሄሎ! *Voicy*የድምጽ መለያ ቡት ሲሆን ሁሉንም የድምጽ መልዕክቶችና የድምጽ ፋይሎች (.ogg, .flac, .wav, .mp3) እንዲሁም በጽሁፍ የተቀበላቸውን ወደ ጽሁፍ ይቀይራል፡፡\n\n*Voicy* ሦስት የድምጽ መለያ ኢንጅኖችን ይደግፋል፡ wit.ai: Yandex SpeechKit እና Google Speech ናቸው፡፡በመጀመሪያ wit.ai እንዲጠቀም የተስተካከለ ቢሆንም ነገር ግን Google Speech ወይም Yandex SpeechKit በማንኛውም ጊዜ እንዲጠቀም አድርገው መቀየር ይችላሉ /ኢንጂን፡፡የበለጠ መረጃ በ ሄልፕ / ያገኛሉ፡፡',
    ge:
      '👋 Hallo! *Voicy* ist ein Stimmerkennungs-Bot, der alle Sprachnachrichten und Audio-Dateien (.ogg, .flac, .wav,. mp3) zu Text umwandelt.\n\n*Voicy* unterstützt drei Stimme-Erkennungs-Engines: wit.ai, Yandex SpeechKit und die Google-Spracherkennung. Vorerst wird wit.ai verwendet, aber du kannst jederzeit mit /engine zu Google Speech oder Yandex SpeechKit wechseln. Weitere Informationen unter /help.',
    it:
      '👋 Ciao! *Voicy* è un programma di riconoscimento vocale che converte tutti i messaggi vocali e i file audio (.ogg, .flac, .wav, .mp3) che riceve in testo. \n\n *Voicy* supporta tre motori di riconoscimento vocale: wit.ai, Yandex, SpeechKit e Google Speech. Inizialmente è impostato per utilizzare wit.ai ma puoi passare a Google Speech o Yandex SpeechKit in qualsiasi momento in /engine. Maggiori informazioni in /help.',
    uz:
      '👋 Salom! *Voicy* � ovozni tushunish boti bo�lib, barcha ovozli xabar va audio fayllarni (.ogg, .flac, .wav, .mp3) matnga aylantiradi.\n\n*Voicy* uchta ovozni tushunish tizimi bilan ishlaydi: wit.ai, Yandex SpeechKit and Google Speech. U odatda wit.ai tizimidan foydalanadi, lekin Google Speech yoki Yandex SpeechKit tizimiga /engine orqali almashtirishingiz mumkin. Batafasil ma�lumotni /help orqali olish mumkin.',
    fr:
      "👋 Bonjour là-bas. *Voicy* est un bot de reconnaissance vocale qui convertit tous les messages vocaux et les fichiers audio (.ogg, .flac, .wav, .mp3) en texte.\n\n*Voicy* prend en charge trois moteurs de reconnaissance vocale: wit.ai, Yandex SpeechKit and Google Speech. Initialement il est configuré pour utiliser wit.ai mais vous pouvez passer à Google Speech ou Yandex SpeechKit à tout moment à engine. Plus d'informations dans aide /help.",
    ko:
      '👋 안녕하세요! *Voicy*는 모든 음성 메세지와 오디오 파일(.ogg, .flac, .wav, .mp3)을 텍스트로 변환하는 음성 인식 봇입니다.\n\n*Voicy*는 세 가지의 음성 인식 엔진을 지원합니다: wit.ai, Yandex SpeechKit 그리고 구글 스피치. *Voicy*는 기본적으로 wit.ai로 설정되어 있지만 구글 스피치나 Yandex SpeechKit를 어느때나 어느 /engine 에서나 이용할 수 있습니다. 더 많은 정보는 /help 에 있습니다.',
    ar:
      '\u200F👋 مرحباً, برنامج صوت هو برنامج للتعرف الصوتي و تحويل الملفات و الرسائل الصوتية(.ogg, .flac, .wav, .mp3) لرسائل مكتوبة text\u200F\n\n\u200Fصوت يدعم برنامج صوت ثلاث محركات تعرف صوتي : wit.ai, Yandex SpeechKit , Google Speech في البدء تم إعداد البرنامج لأستخدام محرك wit.ai ولاكن بأمكانك تغيير المحرك في أي وقت /engine. لمذيد من المعلومات /help.',
    az:
      '👋 Xoş gördük! *Voicy* qəbul etdiyi hər cür səsli mesajları və audio faylarda (.ogg, .oflac, .wav, .mp3) olan danışıqları yazılı formata çevirən səs tanınması botudur.\n\n*Voicy* üç səs tanıması mühərrikini dəstəkləyir: wit.ai, Yandex SpeechKit və Google Speech. Ilkin olaraq wit.ai istifad etməyə quraşdırılıb, lakin istdiyiniz vaxt buradan Google Speech yaxud Yandex SpeechKit dəyişdirə bilərsiniz /engine. Daha çox məlumat burada /help',
    am:
      '👋 Բարև՜։ *Voicy*-ն ձայնի ճանաչման բոտ է, որը ստացված աուդիոֆայլերը և ձայնային նամակները (.ogg, .flac, .wav, .mp3) վերածում է տեքստի։\n\n*Voicy*-ն ապահովում է ձայնի ճանաչման երեք միջոցներ: wit.ai, Yandex SpeechKit and Google Speech: Ի սկզբանե տեղադրվել է wit.ai միջոցը, բայց դուք կարող եք ցանկացած պահի միացնել Google Speech-ը կամ Yandex SpeechKit-ը /engine բաժնում։Ավելի շատ տեղեկատվություն՝ /help բաժնում։',
    ch:
      '👋 各位好！ *Voicy*是一个语音辨识系统，它可以把所有语音讯息及语音档（包括.ogg、.flac、.wav及.mp3）转换成文字。\n\n*Voicy*支援三个语音辨识系统：wit.ai、Yandex SpeechKit及Google Speech。系统预设使用wit.ai，但您可在/engine中随时转换至Google Speech或Yandex SpeechKit。如果您需要更多讯息，请参阅/help。',
    ua:
      '👋 Привіт! *Войсі* це бот розпізнавання голосу, який перетворює всі голосові повідомлення та аудіофайли (.ogg, .flac, .wav, .mp3) у текст.\n\n*Войсі* підтримує три інструменти розпізнавання голосу: wit.ai, Яндекс SpeechKit та Google Speech. Початково він налаштований на використання wit.ai, але ви можете перейти до Google Speech або Яндекс SpeechKit будь-коли в /engine. Більше інформації в /help.',
    no:
      '👋 Hei der! *Voicy* er en stemmegjenkjennings bot som konverterer alle talemeldinger og lydfiler (.ogg, .flac, .wav, .mp3) det mottar til tekst.\n\n*Voicy* støtter tre stemmegjenkjenning motorer: wit.ai, Yandex SpeechKit and Google Speech. Først det satt til bruke wit.ai men du kan bytte til Google Speech eller Yandex SpeechKit når som helst i /engine. Mer informasjon i /help.',
    ja:
      '👋 やっほー！ *ヴォイシー* はボイスメッセージや音声ファイル (.ogg, .flac, .wav, .mp3)を文字におこす音声認識ボットです。\n\n*ヴォイシー* は三種類の音声認識エンジンが使えます: wit.ai, Yandex SpeechKit と Google Speech.。もともとは wit.ai を利用していたのですが、 Google Speech や Yandex SpeechKit を /engine　として利用することもできます。 詳細はこちらで /help.',
    tr:
      "👋 Merhaba! *Voicy*, tüm sesli mesajları ve ses dosyalarını (.ogg, .flac, .wav, .mp3) metne dönüştüren bir ses tanıma botudur.\n\n*Voicy* üç ses tanıma motorunu destekler: wit.ai, Yandex SpeechKit ve Google Speech. Başlangıçta wit.ai kullanmaya ayarlanmıştır. Ancak /engine ile istediğiniz zaman Google Speech veya Yandex SpeechKit’e geçebilirsiniz. Daha fazla bilgi için /help.",
    sv:
      '👋 Hej d�r! *Voicy* �r en r�stigenk�nnings bot som konverterar alla r�stmeddelanden och ljudfiler (.ogg, .flac, .wav, .mp3) den f�r till text.\n\n*Voicy* har st�d f�r tre r�stigenk�nningsmotorer: wit.ai, Yandex SpeechKit and Google Speech. Fr�n b�rjan �r den inst�lld p� att anv�nda wit.ai men du kan byta till Google Speech eller Yandex SpeechKit n�r som helst i /engine. Mer information i /help.',
    pt:
      '👋 Olá! *Voicy* é um bot de reconhecimento de voz que converte todas as mensagens e ficheiros de áudio (.ogg, .flac, .wav, .mp3) que recebe em texto.\n\n*Voicy* suporta três motores de reconhecimento de voz: wit.ai, Yandex SpeechKit e Google Speech. O bot é predefinido para usar wit.ai, mas pode alterar para o Google Speech ou Yandex SpeechKit a qualquer altura. Mais informações em /help.',
    en:
      "👋 Hello there! *Voicy* is a voice recognition bot that converts all voice messages and audio files (.ogg, .flac, .wav, .mp3) it gets into text.\n\n*Voicy* supports three voice recognition engines: wit.ai, Yandex SpeechKit and Google Speech. Initially it's set to use wit.ai but you can switch to Google Speech or Yandex SpeechKit anytime in /engine. More information in /help.",
    es:
      '👋 ¡Hola! *Voicy* es un bot de reconocimiento de voz que convierte todos los mensajes de voz y archivos de audio (.ogg, .flac, .wav, .mp3) que recibe en texto.\n\n*Voicy* soporta tres motores de reconocimiento de voz: wit.ai, Yandex SpeechKit y Google Speech. Inicialmente está predeterminado a utilizar wit.ai pero usted puede cambiarlo a Google Speech o Yandex SpeechKit en cualquier momento en /engine. Más información en /help.',
    ru:
      '👋 Здравствуйте! *Войси* — это бот, который переводит все голосовые сообщения и аудио файлы (.ogg, .flac, .wav, .mp3), которые получает, в текст.\n\n*Войси* поддерживает три движка распознавания речи: wit.ai, Yandex SpeechKit и Google Speech. Изначально, он использует wit.ai, но вы можете переключиться на Google Speech или Yandex SpeechKit в любое время, используя команду /engine. Больше информации в /help.',
  },
  "👋 Please, select the engine of speech recognition. Google Speech is more accurate and supports audio longer than 50 seconds, but has to be set up with your Google Cloud credentials (a bit tedious). Yandex SpeechKit is pretty accurate, free, private and most of the time supports audio longer than 50 seconds, but has limited list of languages. Wit.ai is less accurate, free, and doesn't support audio longer than 50 seconds, but has plenty of languages. Please, note that all three support different languages, so pick the one that suits you the best.": {
    fa:
      '\u200F👋 لطفا موتور تشخیص گفتار را انتخاب کنید. گفتار گوگل دقیق تر است و از صوت بیش از 50 ثانیه پشتیبانی می کند، اما باید با اعتبار Google Cloud شما تنظیم شود (کمی خسته کننده است). Yandex SpeechKit بسیار دقیق، رایگان، خصوصی است و زمان صوتی بیش از 50 ثانیه را پشتیبانی می کند، اما لیست زبان های محدودی دارد. Wit.ai کمتر دقیق است، رایگان است، و از صدای بیش از 50 ثانیه پشتیبانی نمیکند، اما دارای زبان های زیادی است. لطفا توجه داشته باشید که هر سه از زبان های مختلف پشتیبانی می کنند، بنابراین یکی را که به بهترین شکل مناسبتان است را انتخاب کنید.',
    hi:
      '👋 कृपया, स्पीच पहचान के इंजन का चयन करें। Google Speech अधिक सटीक है और 50 सेकंड से अधिक समय वाले ऑडियो को सपोर्ट करता है, लेकिन इसे आपके Google Cloud क्रेडेंशियल्स के साथ सेट अप करना होगा (थोड़ा कठिन)। Yandex SpeechKit काफी सटीक, नि: शुल्क, निजी है और अधिकतर 50 सेकंड से अधिक समय वाले ऑडियो को सपोर्ट करता है, लेकिन सीमित भाषाओं में ही उपलब्ध है। Wit.ai कम सटीक, नि: शुल्क है, और 50 सेकंड से अधिक लंबे समय वाले ऑडियो को सपोर्ट नहीं करता है, लेकिन इसमें बहुत सारी भाषाएँ हैं। कृपया, ध्यान दें कि सभी तीन अलग-अलग भाषाओं का समर्थन करते हैं, इसलिए आपके लिए जो ज्यादा बेहतर है वह चुनें।',
    et:
      '👋 እባክዎ፡የድምጽ መለያ ኢንጂኑን ይምረጡ፡፡ Google Speech (ጉግል የንግግር መለያ) ከ50 ሰከንድ በላይ ለሆኑ የድምጽ ቅጂዎች ይበልጥ የሚያገለግል ሲሆን ነገር ግን Google Cloud credentials (የጉግከል ክላውድ መረጃዎችዎን) በመጠቀም ሊያስጀምሩት ይገባል(በጣም አድካሚ ነው)፡፡ Yandex SpeechKit ደግሞ ነጻ፣ትክክለኛ፣የግል እና በአብዛኛው ጊዜ ከ50 ሰከንድ በላይ የሆኑ ድምጾችን የሚቀበል ሲሆን ነገር ግን የሚጠቀማቸው ቋንቋዎች ዝርዝር አለው፡፡ Wit.ai ትክለኛነቱ ዝቅ ያለ፣ነጻ እናከ50 ሰከንድ በላይ እርዝመት ያላቸውን ድምጾች የማያቀበል ነገርግን የብዙ ቋንቋዎች ዝርዝር ያለው ነው፡፡እባክዎ፡ሦስቱም የተለያዩ ቋንቋዎችን ይቀበላሉ ስለዚህ ለእርስዎ የሚስማማዎትን መርጠው ይጠቀሙ፡፡',
    ge:
      '👋 Bitte wählen Sie die Spracherkennungs-Engine. Google Speech ist genauer und unterstützt Audio, das länger als 50 Sekunden ist, muss aber mit Google-Cloud-Anmeldeinformationen eingerichtet werden (das ist etwas mühsam). Yandex SpeechKit ist ziemlich genau, kostenlos, privat und unterstützt die meiste Zeit Audio mit mehr als 50 Sekunden, hat aber nur eine begrenzt lange Liste von Sprachen. Wit.ai ist weniger genau, kostenlos, unterstützt nur Audio mit maximal 50 Sekunden, hat aber viele Sprachen. Bitte beachte, dass alle drei verschiedene Sprachen unterstützen, wähl also diejenige, die dir am besten passt.',
    it:
      '👋 Per favore, seleziona il motore di riconoscimento vocale. Google Speech è maggiormente accurato e supporta audio più lunghi di 50 secondi, ma deve essere impostato con le tue credenziali di Google Cloud (un po’ noioso). Yandex Speechkit è piuttosto accurato, gratuito, privato e la maggior parte delle volte supporta audio più lunghi di 50 secondi, ma ha una lista limitata di linguaggi. Wit.ai è meno accurato, gratuito, e non supporta audio più lunghi di 50 secondi, ma ha abbondanza di linguaggi. Per favore, notare che tutti e tre i motori supportano differenti linguaggi, quindi scegli quello che si adatta meglio.',
    uz:
      '👋 Ovozni tushunish tizimini tanlang. Google Speech ancha yaxshi ishlaydi va 50 soniyadan uzun audio fayllarni ham o�qiy oladi, lekin Google Cloud shaxsiy ma�lumotlari bilan sozlash kerak bo�ladi (biroz vaqt oladi). Yandex SpeechKit ham yaxshi ishlaydi, bepul, xavfsiz va odatda 50 soniyadan uzun audio fayllarni ham o�qiy oladi, lekin ba�zi tillardagina ishlaydi. Wit.ai is juda yaxshi ishlamasa-da, bepul, 50 soniyadan uzun audio fayllarni o�qiy olmaydi, lekin juda ko�p tilda ishlaydi. Uchalasi har xil tilda ishlaydi. O�zingizga mosini tanlang!',
    fr:
      "👋 S'il vous plaît, sélectionnez le moteur de reconnaissance vocale. Google Speech est plus précis et prend en charge l'audio plus de 50 secondes, mais ce doit être configuré avec vos informations d'identification de Google Cloud (un peu fastidieux).Yandex SpeechKit est assez précis, gratuit, privé et la plupart du temps prend en charge l’audio plu de 50 secondes, mais a liste des langues limité. Wit.ai est moins précis, gratuit et ne supporte pas l'audio plus de 50 secondes, mais il a beaucoup de langues.. Veuillez noter que tous les trois prise en charge différentes langues, alors choisissez celle qui vous convient le mieux.",
    ko:
      '👋 스피치 인식 엔진을 선택해 주세요. 구글 스피치는 더 정확하며 오디오를 50초 더 지원합니다. 그러나 당신의 구글 크리덴셜으로 설정되어 있어야 합니다.(조금 지루하지만요) Yandex SpeechKit은 꽤 정확하며, 무료이고, 프라이빗하며 대부분 오디오를 50초 더 지원하지만, 언어 목록이 한정적입니다. Wit.ai 는 덜 정확하며, 무료이고, 오디오를 50초 더 지원하지는 않습니다. 그러나 언어 선택지가 더 많습니다. 이 세 가지 엔진 모두 다른 언어들을 지원한다는 것을 인식하시고 당신에게 가장 적합한 한 가지를 고르세요.',
    ar:
      '\u200F👋ألرجاء إختيار محرك التعرف الصوتي ,يعتبر محادثات جوجل أكثر دقة و يدعم الملفات الصوتية اطول من 50 ثانية , ولاكن يجب إعداده من خلال بينات سحابة جوجل الخاصة بك (قد تكون عملية طويلة نوعأ ما ) , محرك Yandex SpeechKit دقيق أيضا , مجاني و خصوصي كما انه يدعم الملفات الصوتية اطول من 50 ثانية في أغلب الأحيان إلا انه محدود من ناحية اللغات ,محرك Wit.ai هو الأقل دقة , مجاني , ولا يدعم الملفات الصوتية لأكثر من 50 ثانية إلا انه يدعم الكثير من اللغات .الرجاء العلم أن كل المحركات تدعم لغات متعددة لذالك قم بأختيار المحرك المناسب لك .',
    az:
      '👋 Zəhmət olmasa, nitq tanıması mühərrikini seçin. Google Speech daha dəqiqdir və 50 saniyədən artıq səsləri dəstəkləyir, lakin Google Cloud etibarnamələri il quraşdırılmalıdır (bir qədər müşkülpəsəntdir). Yandex SpeechKit kifayət qədər dəqiqdir, pulsuzdur, şəxsidir və çox vaxt 50 saniyədən artıq səsləri dəstəkləyir, lakin dil siyahısı qısadır. Wit.ai çox da dəqiq deyil, pulsuzdur, 50 saniyədən artıq səsləri dəstəkləmir, lakin dil siyahısı uzundur. Zəhmət olmasa, yadda saxlayın ki, hər üçü müxtəlif dilləri dəstəkləyir, odur ki, özünüzə ən uyğun olanı seçin.',
    am:
      '👋 Ընտրեք ձայնի ճանաչման տարբերակը։ Google Speech-ը ավելի ճշգրիտ է և ապահովում է աուդիոյի տևողություն՝ 50 վայրկյանից ավելի, բայց պետք է տեղադրվի ձեր Google Cloud երաշխավորագրով (մի փոքր հոգնեցուցիչ է)։ Yandex SpeechKit-ը բավականին ճշգրիտ է, անվճար, մասնավոր և շատ դեպքերում ապահովում է 50 վայրկյանից ավելի աուդիոյի տևողություն, բայց լեզուների սահմանափակ ցանկ ունի։ Wit.ai-ն ավելի քիչ ճշգրիտ է, անվճար և 50 վայրկjանից ավելի աուդիոյի տևողություն չի ապահովում, բայց բազմաթիվ լեզուներ ունի։ Ուշադրություն դարձրեք այն հանգամանքին, որ բոլոր երեքը ապահովում են տարբեր լեզուներ, հետևաբար ընտրեք այն մեկը, որը լավագույնս համապատասխանում է ձեզ։',
    ch:
      '👋 请选择语音辨识系统。 Google Speech的准确性较好，并且支援超过50秒的语音档。然而，您需要花费一点时间设立Google云端凭证。 Yandex SpeechKit是一个免费软体，它的准确性也不错，而且这个程式的隐私度较高。这个软体也支援超过50秒的语音档。然而，这个软体支援的语言较少。 Wit.ai也是一个免费软体，它的准确性较低，而且并不支援超过50秒的语音档。然而，这个软体可支援多种不同语言。请注意，三种软体可支援的语言有所不同，您可根据自己的需要选择最适合您的软体。',
    ua:
      '👋 Будь-ласка, оберіть інструмент розпізнавання мови. Google Speech є точнішим і підтримує аудіофайли довше 50 секунд, але його потрібно налаштувати за допомогою ідентифікації особи Google Cloud (трохи втомлює). Яндекс SpeechKit досить точний, безкоштовний, приватний і в більшості випадків підтримує аудіофайли довше 50 секунд, але має обмежений список мов. Wit.ai менш точний, безкоштовний і не підтримує аудіофайли довше 50 секунд, але має багато мов. Будь-ласка, зверніть увагу, що всі три інструменти підтримують різні мови, тому вибирайте той, який вам найбільше підходить.',
    no:
      '👋 Vennligst, velg motoren for talegjenkjenning. Google Speech er mer nøyaktig og støtter lyd lenger enn 50 sekunder, men må settes opp med din Google Cloud legitimasjon (litt kjedelig). Yandex SpeechKit er ganske nøyaktig, gratis, privat og det meste støtter lyd lengre enn 50 sekunder, men har begrenset liste over språk. Wit.ai er mindre nøyaktig, gratis, og støtter ikke lyd lenger enn 50 sekunder, men det har mange språk. Vær oppmerksom på at alle tre støtter forskjellige språk, så velg den som passer deg best.',
    ja:
      '👋 音声認識エンジンを選択してください。Google Speech はとても正確で５０秒以上の音声認識することができますが、Google Cloud credentials とセットアップする必要があります(少し面倒)。 Yandex SpeechKit はまぁまぁ正確、無料、プライベートであり５０秒以上の音声をサポートすることが多いですが、言語が限られています。 Wit.ai はあまり正確ではなく、無料、そして ５０秒以上の音声は認識できませんが、たくさんの言語が選べます。三種類とも複数の言語を認識できますので、自分に合ったものを選んでください。',
    tr:
      '👋 Lütfen, konuşma tanıma motorunu seçin. Google Speech, daha doğru ve 50 saniyeden daha uzun sesleri destekler. Ancak Google Cloud kimlik bilgilerinizle (biraz sıkıcı) kurulması gerekir. Yandex SpeechKit oldukça doğru, ücretsiz, kişisel ve çoğu zaman 50 saniyeden uzun sesleri destekler. Ancak sınırlı dil listesine sahiptir. Wit.ai daha az doğru, ücretsiz ve 50 saniyeden daha uzun sesleri desteklemiyor. Ancak çok sayıda dil seçeneği vardır. Lütfen, üçünün de farklı dilleri desteklediğini unutmayın. Bu nedenle size en uygun olanı seçin.',
    sv:
      '👋 Var god, v�lj motorn f�r r�stigenk�nning. Google Speech �r mer exakt och st�djer audio l�ngre �n 50 sekunder, men m�ste konfigureras med google cloud autentiseringsuppgifter (lite omst�ndigt). Yandex SpeechKit �r ganska exakt, gratis, privat och st�djer f�r det mesta audio �ver 50 sekunder, men st�djer ett begr�nsat antal spr�k. Wit.ai �r inte lika exakt, gratis, och st�djer inte audio l�ngre �n 50 sekunder, men st�djer m�nga olika spr�k. Var god l�gg m�rke till att alla tre st�djer olika spr�k, s� v�lj den som passar dig b�st.',
    pt:
      '👋 Por favor, selecione o motor de reconhecimento de voz. O Google Speech é mais preciso e suporta áudios com mais de 50 segundos, mas tem de ser configurado com as suas credenciais Google Cloud (um pouco entediante). O Yandex SpeechKit é bastante preciso, grátis, privado e na maior parte do tempo suporta áudios com mais de 50 segundos, mas tem uma lista limitada de idiomas. O Wit.ai é menos preciso, é grátis, e não suporta áudios com mais de 50 segundos, mas tem muitos idiomas. Por favor, repare que os três motores suportam vários idiomas, por isso escolha o que melhor se adequa às suas necessidades.',
    en:
      "👋 Please, select the engine of speech recognition. Google Speech is more accurate and supports audio longer than 50 seconds, but has to be set up with your Google Cloud credentials (a bit tedious). Yandex SpeechKit is pretty accurate, free, private and most of the time supports audio longer than 50 seconds, but has limited list of languages. Wit.ai is less accurate, free, and doesn't support audio longer than 50 seconds, but has plenty of languages. Please, note that all three support different languages, so pick the one that suits you the best.",
    es:
      '👋 Por favor, seleccione el motor de reconocimiento de voz. Google Speech es el más preciso y soporta audio mayor a 50 segundos, pero debe ser programado con sus credenciales de Google Cloud (algo tedioso). Yandex SpeechKit es bastante preciso, gratis, privado, y la mayoría del tiempo permite audio mayor que 50 segundos, pero tiene una lista limitada de idiomas. Wit.ai es menos preciso, gratis, y no soporta audio mayor a 50 segundos, pero posee variedad de idiomas. Por favor, note que los tres soportan diferentes idiomas, así que escoja el que más le convenga.',
    ru:
      '👋 Пожалуйста, выберите движок распознавания речи. Google Speech более точный, поддерживает аудио длиннее 50 секунд, но требует, чтобы вы установили аутентификационный файл Google Cloud (немного сложно). Yandex SpeechKit достаточно точный, бесплатный, поддерживает аудио более 50 секунд, но меньше языков. Wit.ai наименее точный, бесплатный, поддерживает файлы короче 50 секунд, но работает с большим количеством языков. Стоит отметить, что разные движки поддерживают разные языки, так что выберите тот, который подходит вам наиболее всего.',
  },
  'Only the person who started command can select options': {
    fa:
      '\u200Fفقط فردی که دستور را را آغاز کرده می تواند گزینه ها را انتخاب کند',
    hi: 'केवल वही व्यक्ति विकल्प चुन सकता है जिसने कमांड शुरू किया',
    et: 'ትዕዛዙን የጀመረው ሰው ብቻ ነው አማራጮችን ሊመርጥ የሚችለው',
    ge: 'Nur die Person, die den Befehl gestartet hat, kann Optionen auswählen',
    it: 'Solo la persona che ha lanciato il comando può selezionare le opzioni',
    uz: 'Buyruqni boshlagan odamgina parametrlarni tanlay oladi',
    fr:
      'Seule la personne qui a lancé la commande pouvez sélectionner des options',
    ko: '명령을 시작한 사람만이 옵션을 선택할 수 있습니다',
    ar: '\u200Fذا الخيار متاح فقط للشخص الذي إختار هذا الامر .',
    az: 'Ancaq əmri başladan şəxs seçimləri edə bilər',
    am: 'Միայն այն անձը, ով մեկնարկում է հրահանգը, կարող է ընտրել',
    ch: '只有启动命令的人可以从选项中选择',
    ua:
      'Тільки людина, яка розпочала команду, може вибрати параметри налаштування',
    no: 'Kun den personen som startet kommandoen, kan velge alternativer',
    ja: 'コマンドを始めた方のみ、オプション選択できます',
    tr: 'Sadece komutu başlatan kişi seçenekleri seçebilir',
    sv: 'Bara personen som startade kommandot kan v�lja inst�llningar',
    pt: 'Só quem iniciou o comando pode selecionar opções',
    en: 'Only the person who started command can select options',
    es: 'Solo la persona que inició comando puede seleccionar opciones',
    ru: 'Только тот, кто запустил выбор, может выбирать настройки',
  },
  "👍 Now *Voicy* uses *$[1]* in this chat. Thank you! Don't forget to set /language.": {
    fa:
      '\u200F👍 اکنون وُیسی از $[1] در این چت استفاده می کند. متشکرم! فراموش نکنید که /language را تنظیم کنید.',
    hi:
      '👍 अब *Voicy* इस चैट में $[1] का उपयोग करता है। धन्यवाद! भाषा सेट करना न भूलें।',
    et:
      '👍 አሁን *Voicy*በዚህ ምልልስ ውስጥ *$[1]*ን ይጠቀማል፡፡እናመሰግናለን!ቋንቋ መምረጥ እንዳለብዎት /እንዳይዘነጉ፡፡',
    ge:
      '👍 *Voicy* verwendet jetzt *$[1]* in diesem Chat. Danke! Vergiss nicht, die Sprache mit /language einzustellen.',
    it:
      '👍 Ora *Voicy* usa *$[1]* in questa chat. Grazie! Non dimenticare di impostare /language.',
    uz:
      '👍 Endi *Voicy* *$[1]*dan bu chatda foydalana oladi. Rahmat! Tilni /language orqali sozlashni unutmang.',
    fr:
      '👍 Maintenant *Voicy* utilise *$[1]* dans ce chat. Merci! Ne pas oublier de mettre la /language.',
    ko:
      '👍 이제 *Voicy*는 이 채팅에서 *$[1]*를 사용합니다. 감사합니다! 언어 설정하는 것을 잊지 마세요.',
    ar:
      '\u200F👍الأن صوت يستخدم $[1] في هذه الدردشة , شكراً ! , الرجاء عدم نسيان إعداد اللغة .',
    az:
      '👍 Artıq *Voicy* *$[1]* bu söhbətdə istifadə edir. Minnətdaram! Quraşdırmağı unutma /language',
    am:
      '👍 Այժմ *Voicy*-ն այս չատում օգտագործում է *$[1]*։ Շնորհակալություն ! չմոռանաք ընտրել /language:',
    ch: '👍 现在，*Voicy*可在本对话中使用*$[1]*了！谢谢！可别忘了设定语言呢。',
    ua:
      '👍 Відтепер *Войсі* використовує *$[1]* у цьому чаті. Дякуємо! Не забудьте встановити /language.',
    no:
      '👍 Nå *Voicy* bruker *$[1]* i denne chatten. Takk! Ikke glem å sette /language.',
    ja:
      '👍 *ヴォイシー* はチャットで *$[1]* を使うよ。ありがとう！/languageを忘れないで。',
    tr:
      '👍*Voicy* artık bu sohbette *$[1]* kullanıyor. Teşekkürler! Dili ayarlamayı unutmayın: /language.',
    sv:
      '👍 *Voicy* anv�nder nu *$[1]* i den h�r chatten. Tack! Gl�m inte att st�lla in /language.',
    pt:
      '👍 Agora *Voicy* usa *$[1]* neste chat. Obrigado! Não se esqueça de definir o /language.',
    en:
      "👍 Now *Voicy* uses *$[1]* in this chat. Thank you! Don't forget to set /language.",
    es:
      '👍 Ahora *Voicy* usa *$[1]* en este chat. ¡Gracias! No olvide establecer /language.',
    ru:
      '👍 Теперь *Войси* использует *$[1]* в этом чате. Спасибо! Не забудьте установить язык через /language.',
  },
  '👋 Please select the language of speech recognition for $[1]': {
    fa: '\u200F👋 لطفا زبان تشخیص گفتار را برای $[1] انتخاب کنید',
    hi: '👋 कृपया $[1] के लिए आवाज की पहचान की भाषा चुनें',
    et: '👋 እባክዎ ለ$[1] የንግግሩን መለያ ቋንቋ አይነት ይምረጡ',
    ge: '👋 Bitte wähl die Sprache der Spracherkennung für $[1].',
    it: '👋 Per favore scegli il linguaggio di riconoscimento vocale per $[1]',
    uz: '👋 $[1] uchun ovozni tushunish tilini tanlang',
    fr: '👋 Veuillez sélectionner la langue de reconnaissance vocale pour $[1]',
    ko: '👋 $[1]의 음성 인식 언어를 선택하세요',
    ar: '\u200F👋ألرجاء إختيار لغة التعرف الصوتي بقيمة $[1] .',
    az: '👋 Zəhmət olmasa, $[1] üçün nitq tanıma dilini seçin',
    am: '👋 Ընտրեք խոսքի ճանաչման լեզուն *$[1]*-ի համար։',
    ch: '👋 请选择您希望$[1]辨识的语言。',
    ua: '👋 Будь-ласка, оберіть мову розпізнавання мовлення для $[1]',
    no: '👋 Vennligst velg språk for talegjenkjenning for $[1]',
    ja: '👋 $[1]の音声認識言語を選択してください。',
    tr: '👋 Lütfen $[1] için konuşma tanıma dilini seçin',
    sv: '👋 Var god v�lj spr�k f�r r�stigenk�nning f�r $[1]',
    pt:
      '👋 Por favor, selecione o idioma para o reconhecimento de voz para $[1]',
    en: '👋 Please select the language of speech recognition for $[1]',
    es: '👋 Por favor seleccione el idioma de reconocimiento de voz $[1]',
    ru: '👋 Пожалуйста, выберите язык распознавания речи для $[1]',
  },
  '👋 Please select the language of speech recognition': {
    fa: '\u200F👋 لطفا زبان تشخیص گفتار را انتخاب کنید',
    hi: '👋 कृपया आवाज की पहचान की भाषा चुनें',
    et: '👋 እባክዎ የንግግሩን መለያ ቋንቋ አይነት ይምረጡ',
    ge: '👋 Bitte wähl die Sprache der Spracherkennung.',
    it: '👋 Per favore scegli il linguaggio di riconoscimento vocale',
    uz: '👋 Ovozni tushunish tilini tanlang',
    fr: '👋 Veuillez sélectionner la langue de reconnaissance vocale',
    ko: '👋 음성 인식 언어를 선택하세요',
    ar: '\u200F👋 ألرجاء إختيار لغة التعرف الصوتي.',
    az: '👋 Zəhmət olmasa, nitq tanıma dilini seçin',
    am: '👋 Ընտրեք խոսքի ճանաչման լեզուն։',
    ch: '👋 请选择您希望辨识的语言。',
    ua: '👋 Будь-ласка, оберіть мову розпізнавання мовлення',
    no: '👋 Vennligst velg språk for talegjenkjenning',
    ja: '👋 の音声認識言語を選択してください。',
    tr: '👋 Lütfen konuşma tanıma dilini seçin',
    sv: '👋 Var god v�lj spr�k f�r r�stigenk�nningen',
    pt: '👋 Por favor, selecione o idioma para o reconhecimento de voz',
    en: '👋 Please select the language of speech recognition',
    es: '👋 Por favor seleccione el idioma de reconocimiento de voz',
    ru: '👋 Пожалуйста, выберите язык распознавания речи',
  },
  '👍 Now *Voicy* speaks *$[1]* (Yandex SpeechKit) in this chat. Thank you!': {
    fa:
      '\u200F👍 اکنون وُیسی در این چت $[1] (Yandex SpeechKit) صحبت می کند. متشکرم!',
    hi: '👍 अब *Voicy* इस चैट में $[1] (Yandex SpeechKit) बोलता है। धन्यवाद!',
    et: '👍 አሁን *Voicy* በዚህ ምልልስ ውስጥ *$[1]* ይናገራል፡፡እናመሰግናለን!',
    ge:
      '👍 *Voicy* spricht jetzt *$[1]* (Yandex SpeechKit) in diesem Chat. Danke!',
    it:
      '👍 Adesso Voicy parla *$[1]* (Yandex SpeechKit) in questa chat. Grazie!',
    uz:
      '👍 Endi *Voicy* bu chatda *$[1]* (Yandex SpeechKit) tilida gaplasha oladi. Rahmat!',
    fr:
      '👍 Maintenant *Voicy* parle *$[1]* (Yandex SpeechKit) dans ce chat.Merci!',
    ko:
      '👍 이제 *Voicy*가 이 채팅에서 *$[1]* (Yandex SpeechKit)을 말합니다. 감사합니다!',
    ar: '\u200F👍ألان صوت يتكلم $[1] (Yandex SpeechKit) في هذه الدردشة . شكراً',
    az:
      '👍 Artıq *Voicy* bu söhbətdə *$[1]* (Yandex SpeechKit) danışır. Minnətdaram!',
    am:
      '👍 Այժմ *Voicy*-ն այս չատում խոսում է *$[1]* (Yandex SpeechKit)-ով։ Շնորհակալություն!',
    ch: '👍 现在，*Voicy*可在本对话中说*$[1]* (Yandex SpeechKit)了！谢谢！',
    ua:
      '👍 Відтепер *Войсі* говорить *$[1]* (Yandex SpeechKit) у цьому чаті. Дякуємо!',
    no:
      '👍 Nå *Voicy* snakker *$[1]* (Yandex SpeechKit) i denne chatten. Takk!',
    ja:
      '👍 これで *ヴォイシー* は *$[1]* (Yandex SpeechKit) を話せるよ。ありがとう！',
    tr:
      '👍 Artık *Voicy* bu sohbette *$[1]* (Yandex SpeechKit) kullanıyor. Teşekkürler!',
    sv:
      '👍 *Voicy* talar nu f�r *$[1]* (Yandex SpeechKit) i den h�r chatten. Tack!',
    pt: '👍 Agora *Voicy* fala *$[1]* (Yandex SpeechKit) neste chat. Obrigado!',
    en:
      '👍 Now *Voicy* speaks *$[1]* (Yandex SpeechKit) in this chat. Thank you!',
    es:
      '👍 Ahora *Voicy* habla *$[1]* (Yandex SpeechKit) en este chat. ¡Gracias!',
    ru:
      '👍 Теперь *Войси* использует *$[1]* (Yandex SpeechKit) в этом чате. Спасибо!',
  },
  '👋 Please select the language of speech recognition for wit.ai.': {
    fa: '\u200F👋 لطفا زبان تشخیص گفتار را برای wit.ai انتخاب کنید.',
    hi: '👋 कृपया wit.ai के लिए आवाज की पहचान की भाषा चुनें।',
    et: '👋 እባክዎ ለ wit.ai የንግግሩን መለያ ቋንቋ አይነት ይምረጡ፡፡',
    ge: '👋 Bitte wähl die Sprache der Spracherkennung für wit.ai.',
    it:
      '👋 Per favore scegli il linguaggio di riconoscimento vocale per wit.ai.',
    uz: '👋 wit.ai uchun ovozni tushunish tilini tanlang.',
    fr:
      '👋 Veuillez sélectionner la langue de reconnaissance vocale pour wit.ai.',
    ko: '👋 Wit.ai의 음성 인식 언어를 선택하세요.',
    ar: '\u200F👋ألرجاء إختيار لغة التعرف الصوتي ل wit.ai.',
    az: '👋 Zəhmət olmasa, wit.ai üçün nitq tanıma dilini seçin.',
    am: '👋 Ընտրեք խոսքի ճանաչման լեզուն wit.ai-ի համար։',
    ch: '👋 请选择您希望wit.ai辨识的语言。',
    ua: '👋 Будь-ласка, оберіть мову розпізнавання мовлення для wit.ai.',
    no: '👋 Vennligst velg språk for talegjenkjenning for wit.ai.',
    ja: '👋 wit.ai. のための音声認識言語を選択してください。',
    tr: '👋 Lütfen wit.ai için konuşma tanıma dilini seçin.',
    sv: '👋 Var god v�lj spr�k f�r r�stigenk�nning f�r wit.ai.',
    pt:
      '👋 Por favor selecione o idioma para o reconhecimento de voz para o wit.ai.',
    en: '👋 Please select the language of speech recognition for wit.ai.',
    es:
      '👋 Por favor seleccione el idioma de reconocimiento de voz para wit.ai.',
    ru: '👋 Пожалуйста, выберите язык распознавания речи для wit.ai.',
  },
  '👍 Now *Voicy* speaks *$[1]* (wit.ai) in this chat. Thank you!': {
    fa: '\u200F👍 اکنون وُیسی در این چت $[1] (wit.ai) صحبت می کند. متشکرم!',
    hi: '👍 अब *Voicy* इस चैट में $[1] (wit.ai) बोलता है। धन्यवाद!',
    et: '👍 አሁን *Voicy* በዚህ ምልልስ ውስጥ *$[1]* (wit.ai) ይናገራል፡፡እናመሰግናለን!',
    ge: '👍 *Voicy* spricht jetzt *$[1]* (wit.ai) in diesem Chat. Danke!',
    it: '👍 Adesso Voicy parla *$[1]* (wit.ai) in questa chat. Grazie!',
    uz:
      '👍 Endi *Voicy* bu chatda *$[1]* (wit.ai) tilida gaplasha oladi. Rahmat!',
    fr: '👍 Maintenant *Voicy* parle *$[1]* (wit.ai) dans ce chat. Merci!',
    ko: '👍 이제 *Voicy*가 이 채팅에서 *$[1]* (Wit.ai)을 말합니다. 감사합니다!',
    ar: '\u200F👍ألان صوت يتكلم $[1] (wit.ai) في هذه الدردشة . شكراً.',
    az: '👍 Artıq *Voicy* bu söhbətdə *$[1]* (wit.ai) danışır. Minnətdaram!',
    am:
      '👍 Այժմ *Voicy*-ն այս չատում խոսում է *$[1]* (wit.ai)-ով։ Շնորհակալություն!',
    ch: '👍 现在，*Voicy*可在本对话中说*$[1]* (wit.ai)了！谢谢！',
    ua: '👍 Відтепер *Войсі* говорить *$[1]* (wit.ai) у цьому чаті. Дякуємо!',
    no: '👍 Nå *Voicy* snakker *$[1]* (wit.ai) i denne chatten. Takk!',
    ja: '👍 これで *ヴォイシー* は *$[1]* (wit.ai) を話せるよ。ありがとう！',
    tr:
      '👍 Artık *Voicy* bu sohbette *$[1]* (wit.ai) kullanıyor. Teşekkürler.',
    sv:
      '👍 *Voicy* talar nu *$[1]* (wit.ai) i den h�r chatten. Tack s� mycket!',
    pt: '👍 Agora *Voicy* fala *$[1]* (wit.ai) neste chat. Obrigado!',
    en: '👍 Now *Voicy* speaks *$[1]* (wit.ai) in this chat. Thank you!',
    es: '👍 Ahora *Voicy* habla *$[1]* (wit.ai) en este chat. ¡Gracias!',
    ru: '👍 Теперь *Войси* использует *$[1]* (wit.ai) В этом чате. Спасибо!',
  },
  '👋 Please select the language of speech recognition for Google Speech.': {
    fa: '\u200F👋 لطفا زبان تشخیص گفتار برای گفتار گوگل را انتخاب کنید.',
    hi: '👋 कृपया Google Speech के लिए आवाज की पहचान की भाषा चुनें।',
    et: '👋 እባክዎ ለ Google Speech የንግግሩን መለያ ቋንቋ አይነት ይምረጡ፡፡',
    ge: '👋 Bitte wähl die Sprache der Spracherkennung für Google Speech.',
    it:
      '👋 Per favore scegli il linguaggio di riconoscimento vocale per Google Speech.',
    uz: '👋 Google Speech uchun ovozni tushunish tilini tanlang.',
    fr:
      '👋 Veuillez sélectionner la langue de reconnaissance vocale pour Google Speech.',
    ko: '👋 구글 스피치의 음성 인식 언어를 선택하세요.',
    ar: '\u200F👋ألرجاء إختيار لغة التعرف الصوتي لمحادثات جوجل .',
    az: '👋 Zəhmət olmasa, Google Speech üçün nitq tanıma dilini seçin.',
    am: '👋 Ընտրեք խոսքի ճանաչման լեզուն Google Speech-ի համար։',
    ch: '👋 请选择您希望Google语音辨识的语言。',
    ua: '👋 Будь-ласка, оберіть мову розпізнавання мовлення для Google Speech.',
    no: '👋 Vennligst velg språk for talegjenkjenning for Google Speech.',
    ja: '👋 Google Speech のための音声認識言語を選択してください。',
    tr: '👋 Lütfen Google Speech için konuşma tanıma dilini seçin.',
    sv: '👋 Var god v�lj spr�ket f�r r�stigenk�nning f�r Google Speech.',
    pt:
      '👋 Por favor selecione o idioma para reconhecimento de voz para o Google Speech.',
    en:
      '👋 Please select the language of speech recognition for Google Speech.',
    es:
      '👋 Por favor seleccione el idioma de reconocimiento de voz para Google Speech.',
    ru: '👋 Пожалуйста, выберите язык распознавания речи для Google Speech.',
  },
  '👍 Now *Voicy* speaks *$[1]* (Google Speech) in this chat. Thank you!': {
    fa:
      '\u200F👍 اکنون وُیسی در این چت $[1] (Google Speech) صحبت می کند. متشکرم!',
    hi: '👍 अब *Voicy* इस चैट में $[1] (Google Speech) बोलता है। धन्यवाद!',
    et: '👍 አሁን *Voicy*በዚህ ምልልስ ውስጥ *$[1]* (Google Speech) ይናገራል፡፡እናመሰግናለን!',
    ge:
      '👍 *Voicy* spricht jetzt *$[1]* (Google Speech) in diesem Chat. Danke!',
    it: '👍 Adesso Voicy parla *$[1]* (Google Speech) in questa chat. Grazie!',
    uz:
      '👍 Endi *Voicy* bu chatda *$[1]* (Google Speech) tilida gaplasha oladi. Rahmat!',
    fr:
      '👍 Maintenant *Voicy* parle *$[1]* (Google Speech) dans ce chat. Merci!',
    ko:
      '👍 이제 *Voicy*가 이 채팅에서 *$[1]* (구글 스피치)을 말합니다. 감사합니다!',
    ar: '\u200F👍ألان صوت يتكلم $[1] ( محادثات جوجل ) في هذه الدردشة . شكراً.',
    az:
      '👍 Artıq *Voicy* bu söhbətdə *$[1]* (Google Speech) danışır. Minnətdaram!',
    am:
      '👍 Այժմ *Voicy*-ն այս չատում խոսում է *$[1]* (Google Speech)-ով։ Շնորհակալություն !',
    ch: '👍 现在，*Voicy*可在本对话中说*$[1]* (Google Speech)了！谢谢！',
    ua:
      '👍 Відтепер *Войсі* говорить *$[1]* (Google Speech) в цьому чаті. Дякуємо!',
    no: '👍 Na *Voicy* snakker *$[1]* (Google Speech) i denne chatten. Takk!',
    ja: '👍 これで *ヴォイシー* は*$[1]* (Google Speech)を話すよ。ありがとう！',
    tr:
      '👍 Artık *Voicy* bu sohbette *$[1]* (Google Speech) kullanıyor. Teşekkürler!',
    sv: '👍 *Voicy* talar nu *$[1]* (Google Speech) i den h�r chatten. Tack!',
    pt: '👍 Agora *Voicy* fala *$[1]* (Google Speech) neste chat. Obrigado!',
    en: '👍 Now *Voicy* speaks *$[1]* (Google Speech) in this chat. Thank you!',
    es: '👍 Ahora *Voicy* habla *$[1]* (Google Speech) en este chat. ¡Gracias!',
    ru:
      '👍 Теперь *Войси* использует *$[1]* (Google Speech) в этом чате. Спасибо!',
  },
  "_👮 I can't recognize voice messages larger than 20 megabytes_": {
    fa:
      '\u200F_👮 من نمی توانم پیام های صوتی بزرگتر از 20 مگابایت را تشخیص دهم_',
    hi: '_👮 मैं 20 मेगाबाइट्स से बड़े वॉयस मैसेज को पहचान नहीं सकता_',
    et: '_👮 እኔ 20 ሜጋባይት በላይ የሆኑ መልዕክቶችን መገንዘብ አልችልም_',
    ge:
      '_👮 Ich kann keine Sprachnachrichten erkennen, die größer als 20 Megabytes sind_',
    it: '_👮 Non posso riconoscere messaggi vocali più grandi di 20 megabytes_',
    uz: '_👮 Men 20 megabaytdan katta ovozli xabarlarni o�qiy olmayman_',
    fr:
      '_👮 Je ne peux pas reconnaître les messages vocaux de plus de 20 megabytes_',
    ko: '_👮 저는 20메가바이트 이상의 음성 메세지는 인식할 수 없습니다_',
    ar: '\u200F👮لا يمكن التعرف على الملفات الصوتي أكبر من 20 ميجابايت .',
    az: '_👮 20 meqabitdən böyük səsli mesajları tanıya bilirəm_',
    am: '_👮 Ես չ/եմ կարողանում ճանաչել 20 մգբ-ից ավելի մեծ ծավալով նամակներ_',
    ch: '_👮 我无法辨识超过20MB的语音讯息_',
    ua: '_👮 Я не можу розпізнати голосові повідомлення більше 20 мегабайт_',
    no:
      '_👮 Jeg kan ikke gjenkjenne talemeldinger som er større enn 20 megabytes_',
    ja: '_👮 ぼく、２０MB以上のボイスメッセージはわからないんだ_',
    tr: "_👮 20 MB'tan büyük sesli mesajları tanıyamıyorum_",
    sv:
      '_👮 Jag kan inte k�nna igen r�stmeddelanden som �r st�rre �n 20 megabytes_',
    pt: '_👮 Não consigo reconhecer mensagens de voz com mais de 20 megabytes_',
    en: "_👮 I can't recognize voice messages larger than 20 megabytes_",
    es: '_👮 No puedo reconocer mensajes de voz más grandes que 20 megabytes_',
    ru: '_👮 Я не умею распознавать файлы тяжелее 20 мегабайт_',
  },
  '_🦄 Voice recognition is initiated..._': {
    fa: '\u200F_🦄 تشخیص صدا آغاز شده است..._',
    hi: '_🦄 आवाज की पहचान शुरू की गई है..._',
    et: '_🦄 የንግግር መለያ እንዲሰራ ተደርጓል…_',
    ge: '_🦄 Spracherkennung wird gestartet..._',
    it: '_🦄 Il riconoscimento vocale è iniziato..._',
    uz: '_🦄 Ovozni tanih ishga tushdi..._',
    fr: '_🦄 La reconnaissance vocale est initiée`_',
    ko: '_🦄 음성 인식이 시작됩니다…_',
    ar: '\u200F🦄تم البداء بالتعرف الصوتي .',
    az: '_🦄 Səs tanıma başladılır..._',
    am: '_🦄 Ձայնի ճանաչումը սկսված է..._',
    ch: '_🦄 语音辨识启动中..._',
    ua: '_🦄 Розпізнавання голосу встановлюється ..._',
    no: '_🦄 Stemmegjenkjenning er initiert..._',
    ja: '_🦄 音声認識をはじめます..._',
    tr: '_🦄 Ses tanıma başlatıldı..._',
    sv: '_🦄 R�stigenk�nning �r initierad..._',
    pt: '_🦄 Reconhecimento de voz iniciado..._',
    en: '_🦄 Voice recognition is initiated..._',
    es: '_🦄 Reconocimiento de voz iniciado..._',
    ru: '_🦄 Распознавание речи инициировано..._',
  },
  '_👮 Wit.ai cannot recognize voice messages longer than 50 seconds_': {
    fa:
      '\u200F_👮 Wit.ai نمیتواند پیام های صوتی طولانی تر از 50 ثانیه را تشخیص دهد_',
    hi: '_👮 Wit.ai 50 सेकंड से अधिक लम्बे वॉयस मैसेज को पहचान नहीं सकता_',
    et: '_👮 Wit.ai ከ50 ሰከንዶች በላይ እርዝማኔ ያለቸውን መልዕክቶች ሊገነዘባቸው አይችልም _',
    ge:
      '_👮 Wit.ai kann keine Sprachnachrichten erkennen, die länger als 50 Sekunden sind_',
    it:
      '_👮 Wit.ai non può riconoscere messaggi vocali più lunghi di 50 secondi_',
    uz: '_👮 Wit.ai 50 soniyadan uzoqroq ovozli xabarlaarni o�qiy olmaydi_',
    fr:
      '_👮 Wit.ai ne peux pas reconnaître les messages vocaux de plus de 50 secondes_',
    ko: '_👮 Wit.ai 는 50초 이상의 음성 메세지는 인식할 수 없습니다_',
    ar: '\u200F👮 لا يمكن التعرف على الرسائل اطول من 50 ثانية Wit.ai .',
    az: '_👮 Wit.ai 50 saniyədən artıq səsli mesajları tanıya bilmir_',
    am:
      '_👮 Wit.ai-ն չի կարող ճանաչել 50 վայրկյանից ավելի տևողությամբ ձայնային հաղորդագրությունները_',
    ch: '_👮 Wit.ai无法辨识超过50秒的语音讯息_',
    ua:
      '_👮 Wit.ai не може розпізнавати голосові повідомлення довше 50 секунд_',
    no: '_👮 Wit.ai kan ikke gjenkjenne talemeldinger lenger enn 50 sekunder_',
    ja: '_👮 Wit.ai は５０秒以上のボイスメッセージを認識できません_',
    tr: '_👮 Wit.ai 50 saniyeden uzun sesli mesajları tanıyamıyor_',
    sv:
      '_👮 Wit.ai kan inte k�nna igen r�stmeddelanden som �r l�ngre �n 50 sekunder_',
    pt:
      '_👮 Wit.ai não consegue reconhecer mensagens de voz com mais de 50 segundos_',
    en: '_👮 Wit.ai cannot recognize voice messages longer than 50 seconds_',
    es:
      '_👮 Wit.ai no puede reconocer mensajes de voz más largos que 50 segundos_',
    ru: '_👮 Wit.ai не умеет распознавать сообщения длиннее 50 секунд_',
  },
  "_👮 Please, speak clearly, I couldn't recognize that_": {
    fa: '\u200F_👮 لطفا به وضوح صحبت کنید، نمی توانم آن را تشخیص دهم_',
    hi: '_👮 कृपया, स्पष्ट रूप से बोलें, मैं उसकी पहचान नहीं कर सका_',
    et: '_👮 እባክዎ፡ልረዳው ስላልቻልኩ በግልጽ ይናገሩ_',
    ge: '_👮 Bitte deutlich sprechen, das konnte ich nicht erkennen_',
    it: '_👮 Per favore, parla chiaramente, non sono riuscito a riconoscerlo_',
    uz: '_👮 Iltimos, Aniq va tiniq o�qing, Men tushuna olmayapman_',
    fr:
      "_👮 Parlez clairement, s'il vous plaît, je ne pouvais pas le reconnaître_",
    ko: '_👮 좀 더 정확하게 말씀해주세요. 인식할 수 없습니다_',
    ar: '\u200F👮ألرجاء التحدث بوضوح , لا أستطيع فهم ذالك .',
    az: '_👮 Zəhmət olmasa, aydın danışın. Bunu tanıya bilmədim_',
    am: '_👮 Խնդրում եմ պարզ խոսեք, ես չ/կարողացա հասկանալ դա_',
    ch: '_👮 您可以说得清楚一点吗？我无法辨识_',
    ua: '_👮 Будь-ласка, говоріть чіткіше, я не можу це розпізнати_',
    no: '_👮 Vennligst, snakk tydelig, jeg kunne ikke gjenkjenne det_',
    ja: '_👮 わかりませんでした。もう少しはっきり話してください_',
    tr: '_👮 Lütfen, daha net konuşun, bunu tanıyamadım_',
    sv: '_👮 Var god prata tydligt, jag kunde inte k�nna igen vad du sa_',
    pt: '_👮 Por favor, fale com clareza, não consegui reconhecer a mensagem_',
    en: "_👮 Please, speak clearly, I couldn't recognize that_",
    es: '_👮 Por favor, hable claro, no pude reconocer eso_',
    ru: '_👮 Пожалуйста, говорите четче_',
  },
  "_👮 I couldn't recognize that_": {
    fa: '\u200F_👮 من نمی توانم آن را تشخیص دهم_',
    hi: '_👮 मैं उसकी पहचान नहीं कर सका_',
    et: '_👮 ይህንንላውቀው አልቻልኩም_',
    ge: '_👮 Das konnte ich nicht erkennen_',
    it: '_👮 Non sono riuscito a riconoscerlo_',
    uz: '_👮 Men tushuna olmayapman_',
    fr: '_👮 Je ne pouvais pas le reconnaître_',
    ko: '_👮 인식할 수 없습니다_',
    ar: '\u200F👮لا أستطيع فهم ذالك .',
    az: '_👮 Bunu tanıya bilmədim_',
    am: '_👮 Խնդրում եմ պարզ խոսեք, ես չ/կարողացա հասկանալ դա_',
    ch: '_👮 我无法辨识_',
    ua: '_👮 Я не можу це розпізнати_',
    no: "_👮 Jeg kunne ikke't gjenkjenne det_",
    ja: '_👮 わかりませんでした_',
    tr: '_👮 Bunu tanıyamadım_',
    sv: '_👮 Jag kunde inte k�nna igen det_',
    pt: '_👮 Não consegui reconhecer a mensagem_',
    en: "_👮 I couldn't recognize that_",
    es: '_👮 No pude reconocer eso_',
    ru: '_👮 У меня не получилось это распознать_',
  },
  '😮 Please, set up google credentials with the /google command or change the engine with the /engine command. Your credentials are not set up yet.': {
    fa:
      '\u200F😮 لطفا اعتبارنامه گوگل را با دستور /google تنظیم کنید یا موتور را با فرمان /engine تغییر دهید. اعتبارنامه های شما هنوز تنظیم نشده است.﻿',
    hi:
      '_😮 कृपया, /google command के साथ गूगल क्रेडेंशियल्स को सेट करें या इंजन को /इंजन कमांड के साथ बदल दें। आपके क्रेडेंशियल्स अभी तक सेटअप नहीं हैं।_',
    et:
      '_😮 እባክዎ፡የ Google credentials (የጉግል መረጃዎችን) /google command or change the engine (የጉግል ትዕዛዛት ወይም ኢንጂኑን ቀይር)/ከኢንጂን ትዕዛዝ ጋር ያድርጉት፡፡መረጃዎችም እስካሁን አልተያያዙም፡፡_',
    ge:
      '😮 Bitte richte die Google-Anmeldeinformationen mit dem /google Befehl ein oder ändere die Engine mit dem Befehl /engine. Deine Zugangsdaten sind noch nicht eingerichtet.',
    it:
      '😮 Per favore, imposta le credenziali di Google con il comando /google oppure cambia motore con il comando /engine. Le tue credenziali non sono ancora impostate.',
    uz:
      '😮 Google shaxsiy ma�lumotlrini /google command yordamida sozlang yoki /engine command yordamida tizimni almashtiring. Shaxsiy ma�lumotlaringiz haligacha sozlanmagan.',
    fr:
      "😮 Installez, s'il vous plaît, les informations d'identification avec la commande de google ou changez le moteur avec la commande engine.",
    ko:
      '😮 구글 크리덴셜을 /google 명령으로 설정하거나 엔진을 /engine 명령으로 전환하세요. 당신의 크리덴셜이 아직 설정되지 않았습니다.',
    ar:
      '\u200F😮ألرجاء إعداد بينات جوجل من خلال إعدادات جوجل أو تغيير المحرك من خلال إعدادات المحرك . لم يتم إعداد بيناتك بعد .',
    az:
      '😮 Zəhmət olmasa, google etibarnamələrini /google əmri ilə quraşdırın, yaxud /engine əmri ilə mühərriki dəyişin. Sizin etibarnamələriniz hələ quraşdırılmayıb.',
    am:
      '😮 Տեղադրեք google երաշխավորագիրը /google հրահանգով, կամ փոխեք միջոցները /engine հրահանգով։ Ձեր երաշխավորագրերը դեռևս տեղադրված չեն.',
    ch:
      '😮 请以/google命令设立Google凭证，或以/engine命令更改使用的系统。您尚未设立凭证。',
    ua:
      '😮 Будь-ласка, налаштуйте ідентифікацію особи Google за допомогою команди /google або змініть інструмент за допомогою команди /engine. Ваші дані ідентифікації особи ще не налаштовані.',
    no:
      '😮 Vennligst, oppsett google legitimasjon med /google kommandoen eller endre motoren med /engine kommandoen. Din legitimasjon er ikke satt opp ennå.',
    ja:
      '😮 /google コマンドでグーグルクレデンシャルを設定するか、/engine コマンドでエンジンを変更してください。クレデンシャルのセットアップができていません。',
    tr:
      '😮 Lütfen /google komutunu kullanarak Google kimlik bilgilerinizi ayarlayın ya da motoru /engine komutuyla değiştirin. Kimlik bilgileriniz henüz ayarlanmamış.',
    sv:
      '😮 Var god, st�ll in google autentiseringsuppgifter med /google command eller byt motor med /engine command. Dina autentiseringsuppgifter �r inte inst�llda �n.',
    pt:
      '😮 Por favor, configure as credenciais Google com o comando /google ou altere o motor com o comando /engine. As suas credenciais ainda não foram configuradas.',
    en:
      '😮 Please, set up google credentials with the /google command or change the engine with the /engine command. Your credentials are not set up yet.',
    es:
      '😮 Por favor, establezca las credenciales google con el comando /google o cambie el motor con el comando /engine. Sus credenciales aún no se han establecido.',
    ru:
      '😮 Пожалуйста, установите аутентификационный файл для Google Cloud через команду /google или смените движок распознавания речи через /engine. Аутентификационный файл еще не установлен.',
  },
}

const languages = {
  wit: {
    English: 'en',
    Russian: 'ru',
    Spanish: 'es',
    Portugese: 'pt',
    Swedish: 'sv',
    Turkish: 'tr',
    Japanese: 'ja',
    Norwegian: 'no',
    Ukrainian: 'ua',
    Chinese: 'ch',
    Azerbaijani: 'az',
    Arabic: 'ar',
    Korean: 'ko',
    French: 'fr',
    Uzbek: 'uz',
    Italian: 'it',
    German: 'ge',
    Hindi: 'hi',
    Persian: 'fa',
  },
  google: {
    'ru-RU': 'ru',
    'en-AU': 'en',
    'en-CA': 'en',
    'en-GH': 'en',
    'en-GB': 'en',
    'en-IN': 'en',
    'en-IE': 'en',
    'en-KE': 'en',
    'en-NZ': 'en',
    'en-NG': 'en',
    'en-PH': 'en',
    'en-ZA': 'en',
    'en-TZ': 'en',
    'en-US': 'en',
    'es-AR': 'es',
    'es-BO': 'es',
    'es-CL': 'es',
    'es-CO': 'es',
    'es-CR': 'es',
    'es-EC': 'es',
    'es-SV': 'es',
    'es-ES': 'es',
    'es-US': 'es',
    'es-GT': 'es',
    'es-HN': 'es',
    'es-MX': 'es',
    'es-NI': 'es',
    'es-PA': 'es',
    'es-PY': 'es',
    'es-PE': 'es',
    'es-PR': 'es',
    'es-DO': 'es',
    'es-UY': 'es',
    'es-VE': 'es',
    'pt-BR': 'pt',
    'pt-PT': 'pt',
    'sv-SE': 'sv',
    'tr-TR': 'tr',
    'ja-JP': 'ja',
    'nb-NO': 'no',
    'uk-UA': 'ua',
    'cmn-Hant-TW': 'ch',
    'yue-Hant-HK': 'ch',
    'cmn-Hans-HK': 'ch',
    'cmn-Hans-CN': 'ch',
    'hy-AM': 'am',
    'az-AZ': 'az',
    'ar-IL': 'ar',
    'ar-JO': 'ar',
    'ar-AE': 'ar',
    'ar-BH': 'ar',
    'ar-DZ': 'ar',
    'ar-SA': 'ar',
    'ar-IQ': 'ar',
    'ar-KW': 'ar',
    'ar-MA': 'ar',
    'ar-TN': 'ar',
    'ar-OM': 'ar',
    'ar-PS': 'ar',
    'ar-QA': 'ar',
    'ar-LB': 'ar',
    'ar-EG': 'ar',
    'ko-KR': 'ko',
    'fr-CA': 'fr',
    'fr-FR': 'fr',
    'it-IT': 'it',
    'de-DE': 'ge',
    'am-ET': 'et',
    'hi-IN': 'hi',
    'fa-IR': 'fa',
  },
  yandex: {
    'ru-RU': 'ru',
    'en-US': 'en',
    'tr-TR': 'tr',
    'uk-UK': 'ua',
  },
}

// Exports
module.exports = {
  localizations,
  languages,
  check,
}
