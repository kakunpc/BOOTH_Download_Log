document.addEventListener('DOMContentLoaded', function () {
  //HTML 内の data-i18n 属性をもつ要素のテキストを置換する
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
    if (msg) {
      el.textContent = msg;
    }
  });

  const toggleCheckbox = document.getElementById("toggleFree");
  const toggleGroupCheckbox = document.getElementById("toggleGroup");
  const toggleBulkRegisterCheckbox = document.getElementById("toggleBulkRegister");
  const folderInput = document.getElementById("downloadFolder");
  const saveFolderBtn = document.getElementById("saveFolder");
  const toggleDeleteAfterRegisterCheckbox = document.getElementById("toggleDeleteAfterRegister");

  // 初回起動時に free 属性が空のエントリを false に更新
  chrome.storage.local.get("downloadHistory", function (result) {
    let history = result.downloadHistory || [];
    let updated = false;
    for (let i = 0; i < history.length; i++) {
      if (history[i].free === undefined || history[i].free === null || history[i].free === "") {
        history[i].free = false;
        updated = true;
      }
    }
    if (updated) {
      chrome.storage.local.set({ downloadHistory: history }, function () {
        renderHistory();
      });
    } else {
      renderHistory();
    }
  });

  // ヘルパー関数: タイムスタンプを "YYYY-MM-DD HH:mm:ss" 形式にフォーマット
  function formatTimestamp(ts) {
    const date = new Date(ts);
    const pad = n => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  // CSVフィールド用のエスケープ関数
  function escapeCSV(value) {
    if (value == null) return "";
    let str = value.toString();
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }

  // 保存済みのフォルダパスを読み込む
  chrome.storage.local.get("downloadFolderPath", function (result) {
    if (result.downloadFolderPath) {
      folderInput.value = result.downloadFolderPath;
    }
  });

  // 「保存」ボタンのクリックイベントで値を保存
  saveFolderBtn.addEventListener("click", function () {
    const folderPath = folderInput.value.trim();
    chrome.storage.local.set({ downloadFolderPath: folderPath });
  });

  // alert で使用する多言語メッセージの例（フォルダパス未設定時）
  function showFolderNotSetAlert() {
    alert(chrome.i18n.getMessage("saveFolderNotSet"));
  }

  // 履歴一覧を描画する関数（toggleCheckboxがチェックなら free:true のものだけ表示）
  function renderHistory() {
    chrome.storage.local.get("downloadHistory", function (result) {
      let history = result.downloadHistory || [];
      if (toggleCheckbox.checked) {
        history = history.filter(entry => entry.free === true);
      }
      // タイムスタンプ降順にソート（最新が先頭）
      history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const container = document.getElementById("history-list");
      container.innerHTML = "";
      if (history.length === 0) {
        container.innerHTML = `<p>${chrome.i18n.getMessage("noHistory")}</p>`;
        return;
      }

      if (toggleGroupCheckbox.checked) {
        // 同一アイテムをまとめる処理
        const groupedHistory = {};
        history.forEach(entry => {
          if (!groupedHistory[entry.boothID]) {
            groupedHistory[entry.boothID] = {
              title: entry.title,
              url: entry.url,
              boothID: entry.boothID,
              entries: [],
              latestTimestamp: new Date(entry.timestamp)
            };
          }
          groupedHistory[entry.boothID].entries.push(entry);
          const entryTime = new Date(entry.timestamp);
          if (entryTime > groupedHistory[entry.boothID].latestTimestamp) {
            groupedHistory[entry.boothID].latestTimestamp = entryTime;
          }
        });

        const sortedGroups = Object.values(groupedHistory).sort((a, b) =>
          b.latestTimestamp - a.latestTimestamp
        );

        sortedGroups.forEach(group => {
          group.entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          const latestEntry = group.entries[0];
          group.title = latestEntry.title;
          group.url = latestEntry.url;

          const entryDiv = document.createElement("div");
          entryDiv.className = "entry";
          entryDiv.style.display = "flex";
          entryDiv.style.flexDirection = "column";
          entryDiv.style.borderBottom = "1px solid #ccc";
          entryDiv.style.padding = "5px 0";
          entryDiv.style.marginBottom = "4px";

          // タイトル行
          const titleLine = document.createElement("div");
          const titleLink = document.createElement("a");
          titleLink.href = group.url && group.url.trim() ? group.url : `https://booth.pm/ja/items/${group.boothID}`;
          titleLink.target = "_blank";
          titleLink.textContent = group.title;
          titleLink.style.fontSize = "0.9em";
          titleLink.style.whiteSpace = "nowrap";
          titleLink.style.overflow = "hidden";
          titleLink.style.textOverflow = "ellipsis";
          if (group.entries.every(entry => entry.deleted)) {
            titleLink.style.textDecoration = "line-through";
          }
          titleLine.appendChild(titleLink);
          entryDiv.appendChild(titleLine);

          // 一括登録モードの場合、複数ファイルのグループのみ表示
          if (toggleBulkRegisterCheckbox.checked) {
            // 複数のアイテムがある場合のみ表示
            // if (group.entries.length > 1) {
            // ファイル一覧とボタンのコンテナ
            const infoLine = document.createElement("div");
            infoLine.style.display = "flex";
            infoLine.style.alignItems = "flex-start";
            infoLine.style.marginTop = "2px";

            // ファイル一覧
            const fileListDiv = document.createElement("div");
            fileListDiv.style.flexGrow = "1";
            fileListDiv.style.fontSize = "0.9em";
            group.entries.forEach(entry => {
              const fileEntry = document.createElement("div");
              fileEntry.style.whiteSpace = "nowrap";
              fileEntry.style.overflow = "hidden";
              fileEntry.style.textOverflow = "ellipsis";
              if(entry.deleted) {
                fileEntry.style.textDecoration = "line-through";
              }
              const formattedTime = formatTimestamp(entry.timestamp);
              fileEntry.textContent = `[${formattedTime}] ${entry.filename}`;
              fileListDiv.appendChild(fileEntry);
            });

            // ボタンコンテナ
            const btnContainer = document.createElement("div");
            btnContainer.style.display = "flex";
            btnContainer.style.gap = "10px";
            btnContainer.style.flexShrink = "0";
            btnContainer.style.marginLeft = "10px";

            // KonoAssetボタン
            const konoBtn = document.createElement("button");
            konoBtn.textContent = "KonoAsset";
            Object.assign(konoBtn.style, {
              fontSize: "1em",
              padding: "6px 12px",
              minWidth: "130px",
              cursor: "pointer"
            });
            konoBtn.addEventListener("click", function (event) {
              event.stopPropagation();
              event.preventDefault();
              chrome.storage.local.get("downloadFolderPath", function (result) {
                const path = result.downloadFolderPath || "";
                if (path.trim() === "") {
                  showFolderNotSetAlert();
                  return;
                }
                const pathParams = group.entries
                  .map(entry => `path=${encodeURIComponent(path + "/" + entry.filename)}`)
                  .join("&");
                const assetUrl = `konoasset://addAsset?${pathParams}&id=${group.boothID}`;
                window.location.href = assetUrl;
                if (toggleDeleteAfterRegisterCheckbox.checked) {
                  // 削除チェックを入れる
                  group.entries.forEach(entry => {
                    entry.deleted = true;
                  });
                  chrome.storage.local.get("downloadHistory", function (result) {
    
                    // 各エントリの deleted フラグを更新
                    const updatedHistory = result.downloadHistory.map(h => {
                      const entryToUpdate = group.entries.find(e => e.boothID === h.boothID && e.filename === h.filename);
                      if (entryToUpdate) {
                        return { ...h, deleted: entryToUpdate.deleted };
                      }
                      return h;
                    });
                    chrome.storage.local.set({ downloadHistory: updatedHistory }, function () {
                      renderHistory();
                    });
                  });
                }
              });
            });
            
            // 削除Toggle
            const deleteToggle = document.createElement("input");
            deleteToggle.type = "checkbox";
            deleteToggle.checked = group.entries[0].deleted || false;
            deleteToggle.style.cursor = "pointer";
            deleteToggle.addEventListener("change", function (event) {
              group.entries.forEach(entry => {
                entry.deleted = event.target.checked;
              });
              chrome.storage.local.get("downloadHistory", function (result) {

                // 各エントリの deleted フラグを更新
                const updatedHistory = result.downloadHistory.map(h => {
                  const entryToUpdate = group.entries.find(e => e.boothID === h.boothID && e.filename === h.filename);
                  if (entryToUpdate) {
                    return { ...h, deleted: entryToUpdate.deleted };
                  }
                  return h;
                });
                chrome.storage.local.set({ downloadHistory: updatedHistory }, function () {
                  renderHistory();
                });
              });
            });

            btnContainer.appendChild(konoBtn);
            btnContainer.appendChild(deleteToggle);
            infoLine.appendChild(fileListDiv);
            infoLine.appendChild(btnContainer);
            entryDiv.appendChild(infoLine);
            container.appendChild(entryDiv);

            // }
          } else {
            // 通常の表示（各ファイルごとにボタンを表示）
            group.entries.forEach(entry => {
              const infoLine = document.createElement("div");
              infoLine.style.display = "flex";
              infoLine.style.alignItems = "center";
              infoLine.style.marginTop = "2px";

              const formattedTime = formatTimestamp(entry.timestamp);
              const infoText = document.createElement("span");
              infoText.textContent = `[${formattedTime}] ${entry.filename}`;
              infoText.style.fontSize = "0.9em";
              infoText.style.whiteSpace = "nowrap";
              infoText.style.overflow = "hidden";
              infoText.style.textOverflow = "ellipsis";
              infoText.style.flexGrow = "1";
              if (entry.deleted) {
                infoText.style.textDecoration = "line-through";
              }

              const btnContainer = document.createElement("div");
              btnContainer.style.display = "flex";
              btnContainer.style.gap = "10px";
              btnContainer.style.flexShrink = "0";

              if ((entry.filename || "").trim() !== "") {
                const btnStyle = {
                  fontSize: "1em",
                  padding: "6px 12px",
                  minWidth: "130px",
                  cursor: "pointer"
                };

                // AvatarExplorerボタン
                const avatarBtn = document.createElement("button");
                avatarBtn.textContent = "AvatarExplorer";
                Object.assign(avatarBtn.style, btnStyle);
                avatarBtn.addEventListener("click", function (event) {
                  event.stopPropagation();
                  event.preventDefault();
                  chrome.storage.local.get("downloadFolderPath", function (result) {
                    const dir = result.downloadFolderPath || "";
                    if (dir.trim() === "") {
                      showFolderNotSetAlert();
                      return;
                    }
                    const assetUrl = `vrcae://addAsset?dir=${encodeURIComponent(dir + "/" + entry.filename)}&id=${entry.boothID}`;
                    window.location.href = assetUrl;
                    if (toggleDeleteAfterRegisterCheckbox.checked) {
                      // 削除チェックを入れる
                      entry.deleted = true;
                      chrome.storage.local.get("downloadHistory", function (result) {
                        const updatedHistory = result.downloadHistory.map(h => h.boothID === entry.boothID && h.filename === entry.filename ? entry : h);
                        chrome.storage.local.set({ downloadHistory: updatedHistory }, function () {
                          renderHistory();
                        });
                      });
                    }
                  });
                });

                // KonoAssetボタン
                const konoBtn = document.createElement("button");
                konoBtn.textContent = "KonoAsset";
                Object.assign(konoBtn.style, btnStyle);
                konoBtn.addEventListener("click", function (event) {
                  event.stopPropagation();
                  event.preventDefault();
                  chrome.storage.local.get("downloadFolderPath", function (result) {
                    const path = result.downloadFolderPath || "";
                    if (path.trim() === "") {
                      showFolderNotSetAlert();
                      return;
                    }
                    const assetUrl = `konoasset://addAsset?path=${encodeURIComponent(path + "/" + entry.filename)}&id=${entry.boothID}`;
                    window.location.href = assetUrl;
                    if (toggleDeleteAfterRegisterCheckbox.checked) {
                      // 削除チェックを入れる
                      entry.deleted = true;
                      chrome.storage.local.get("downloadHistory", function (result) {
                        const updatedHistory = result.downloadHistory.map(h => h.boothID === entry.boothID && h.filename === entry.filename ? entry : h);
                        chrome.storage.local.set({ downloadHistory: updatedHistory }, function () {
                          renderHistory();
                        });
                      });
                    }
                  });
                });

                // 削除Toggle
                const deleteToggle = document.createElement("input");
                deleteToggle.type = "checkbox";
                deleteToggle.checked = entry.deleted || false;
                deleteToggle.style.cursor = "pointer";
                deleteToggle.addEventListener("change", function (event) {
                  entry.deleted = event.target.checked;
                  chrome.storage.local.get("downloadHistory", function (result) {
                    const updatedHistory = result.downloadHistory.map(h => h.boothID === entry.boothID && h.filename === entry.filename ? entry : h);
                    chrome.storage.local.set({ downloadHistory: updatedHistory }, function () {
                      renderHistory();
                    });
                  });
                });
                btnContainer.appendChild(avatarBtn);
                btnContainer.appendChild(konoBtn);
                btnContainer.appendChild(deleteToggle);
              }

              infoLine.appendChild(infoText);
              infoLine.appendChild(btnContainer);
              entryDiv.appendChild(infoLine);
            });
            container.appendChild(entryDiv);
          }
        });
      } else {
        // 従来の表示方法
        history.forEach(entry => {
          const formattedTime = formatTimestamp(entry.timestamp);
          const linkUrl = entry.url && entry.url.trim() ? entry.url : `https://booth.pm/ja/items/${entry.boothID}`;

          // エントリ全体のコンテナ（2段表示）
          const entryDiv = document.createElement("div");
          entryDiv.className = "entry";
          entryDiv.style.display = "flex";
          entryDiv.style.flexDirection = "column";
          entryDiv.style.borderBottom = "1px solid #ccc";
          entryDiv.style.padding = "5px 0";
          entryDiv.style.marginBottom = "4px";

          // 上段：タイトル（リンク付き）
          const titleLine = document.createElement("div");
          const titleLink = document.createElement("a");
          titleLink.href = linkUrl;
          titleLink.target = "_blank";
          titleLink.textContent = entry.title;
          titleLink.style.fontSize = "0.9em";
          titleLink.style.whiteSpace = "nowrap";
          titleLink.style.overflow = "hidden";
          titleLink.style.textOverflow = "ellipsis";
          if (entry.deleted) {
            titleLink.style.textDecoration = "line-through";
          }
          titleLine.appendChild(titleLink);

          // 下段：タイムスタンプ、ファイル名、ボタン群
          const infoLine = document.createElement("div");
          infoLine.style.display = "flex";
          infoLine.style.alignItems = "center";
          infoLine.style.marginTop = "2px";

          // 左側：タイムスタンプとファイル名
          const infoText = document.createElement("span");
          infoText.textContent = `[${formattedTime}] ${entry.filename}`;
          infoText.style.fontSize = "0.9em";
          infoText.style.whiteSpace = "nowrap";
          infoText.style.overflow = "hidden";
          infoText.style.textOverflow = "ellipsis";
          infoText.style.flexGrow = "1";
          if (entry.deleted) {
            infoText.style.textDecoration = "line-through";
          }

          // 右側：ボタン群（ファイル名が空でない場合のみ追加）
          const btnContainer = document.createElement("div");
          btnContainer.style.display = "flex";
          btnContainer.style.gap = "10px";
          btnContainer.style.flexShrink = "0";
          if ((entry.filename || "").trim() !== "") {
            // 共通ボタンスタイル
            const btnStyle = {
              fontSize: "1em",
              padding: "6px 12px",
              minWidth: "130px",
              cursor: "pointer"
            };

            // AvatarExplorerボタン
            const avatarBtn = document.createElement("button");
            avatarBtn.textContent = "AvatarExplorer";
            Object.assign(avatarBtn.style, btnStyle);
            avatarBtn.addEventListener("click", function (event) {
              event.stopPropagation();
              event.preventDefault();
              chrome.storage.local.get("downloadFolderPath", function (result) {
                const dir = result.downloadFolderPath || "";
                if (dir.trim() === "") {
                  showFolderNotSetAlert();
                  return;
                }
                const assetUrl = `vrcae://addAsset?dir=${encodeURIComponent(dir + "/" + entry.filename)}&id=${entry.boothID}`;
                window.location.href = assetUrl;
                if (toggleDeleteAfterRegisterCheckbox.checked) {
                  // 削除チェックを入れる
                  entry.deleted = true;
                  chrome.storage.local.get("downloadHistory", function (result) {
                    const updatedHistory = result.downloadHistory.map(h => h.boothID === entry.boothID && h.filename === entry.filename ? entry : h);
                    chrome.storage.local.set({ downloadHistory: updatedHistory }, function () {
                      renderHistory();
                    });
                  });
                }
              });
            });

            // KonoAssetボタン
            const konoBtn = document.createElement("button");
            konoBtn.textContent = "KonoAsset";
            Object.assign(konoBtn.style, btnStyle);
            konoBtn.addEventListener("click", function (event) {
              event.stopPropagation();
              event.preventDefault();
              chrome.storage.local.get("downloadFolderPath", function (result) {
                const path = result.downloadFolderPath || "";
                if (path.trim() === "") {
                  showFolderNotSetAlert();
                  return;
                }
                const assetUrl = `konoasset://addAsset?path=${encodeURIComponent(path + "/" + entry.filename)}&id=${entry.boothID}`;
                window.location.href = assetUrl;
                if (toggleDeleteAfterRegisterCheckbox.checked) {
                  // 削除チェックを入れる
                  entry.deleted = true;
                  chrome.storage.local.get("downloadHistory", function (result) {
                    const updatedHistory = result.downloadHistory.map(h => h.boothID === entry.boothID && h.filename === entry.filename ? entry : h);
                    chrome.storage.local.set({ downloadHistory: updatedHistory }, function () {
                      renderHistory();
                    });
                  });
                }
              });
            });

            btnContainer.appendChild(avatarBtn);
            btnContainer.appendChild(konoBtn);
          }
          // 削除Toggle
          const deleteToggle = document.createElement("input");
          deleteToggle.type = "checkbox";
          deleteToggle.checked = entry.deleted || false;
          deleteToggle.style.cursor = "pointer";
          deleteToggle.addEventListener("change", function (event) {
            entry.deleted = event.target.checked;
            chrome.storage.local.get("downloadHistory", function (result) {
              const updatedHistory = result.downloadHistory.map(h => h.boothID === entry.boothID && h.filename === entry.filename ? entry : h);
              chrome.storage.local.set({ downloadHistory: updatedHistory }, function () {
                renderHistory();
              });
            });
          });
          btnContainer.appendChild(deleteToggle);

          infoLine.appendChild(infoText);
          infoLine.appendChild(btnContainer);

          entryDiv.appendChild(titleLine);
          entryDiv.appendChild(infoLine);

          container.appendChild(entryDiv);
        });
      }
    });
  }

  // トグル変更時に再描画
  toggleCheckbox.addEventListener("change", function () {
    renderHistory();
  });

  // トグルチェックボックスのイベントリスナーを追加
  toggleGroupCheckbox.addEventListener("change", renderHistory);
  toggleBulkRegisterCheckbox.addEventListener("change", renderHistory);

  // JSON 出力 (AE Tools形式)
  document.getElementById("export-ae").addEventListener("click", () => {
    chrome.storage.local.get("downloadHistory", function (result) {
      const history = result.downloadHistory || [];
      const grouped = {};
      history.forEach(entry => {
        const { title, boothID, filename, timestamp } = entry;
        if (!filename) return;
        if (!grouped[boothID]) {
          grouped[boothID] = {
            id: boothID,
            title: title,
            files: [filename],
            timestamp: timestamp
          };
        } else {
          grouped[boothID].files.push(filename);
          if (new Date(timestamp) > new Date(grouped[boothID].timestamp)) {
            grouped[boothID].title = title;
            grouped[boothID].timestamp = timestamp;
          }
        }
      });
      const outputArray = Object.values(grouped)
        .filter(group => group.files && group.files.length > 0)
        .map(group => ({
          title: group.title,
          id: Number(group.id),
          files: group.files
        }));
      const jsonContent = JSON.stringify(outputArray, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url: url,
        filename: "downloadHistory_AE.json",
        conflictAction: "overwrite",
        saveAs: true
      }, (downloadId) => {
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      });
    });
  });

  // CSV 出力ボタン
  document.getElementById("btn-csv-export").addEventListener("click", () => {
    chrome.storage.local.get("downloadHistory", function (result) {
      let history = result.downloadHistory || [];
      // タイムスタンプの降順にソート（最新のものが先頭になるように）
      history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // CSVヘッダー
      const header = ['URL', 'timestamp', 'boothID', 'title', 'fileName', 'free'].map(escapeCSV).join(',');
      const lines = [header];

      history.forEach(entry => {
        // URLが空の場合はbooth.pm/(lang)/items/で埋める
        const uiLang = chrome.i18n.getUILanguage();
        let lang;
        if (uiLang.startsWith("ja")) {
          lang = "ja";
        } else if (uiLang.startsWith("ko")) {
          lang = "ko";
        } else {
          lang = "en";
        }
        const url = entry.url && entry.url.trim() ? entry.url : `https://booth.pm/${lang}/items/${entry.boothID}`;
        const line = [
          url,
          entry.timestamp,
          entry.boothID,
          entry.title,
          entry.filename,
          entry.free
        ].map(escapeCSV).join(',');
        lines.push(line);
      });

      const csvContent = lines.join('\n');
      // BOMを付与してUTF-8で出力
      const csvContentWithBom = "\uFEFF" + csvContent;
      const blob = new Blob([csvContentWithBom], { type: "text/csv;charset=UTF-8" });
      const urlBlob = URL.createObjectURL(blob);

      chrome.downloads.download({
        url: urlBlob,
        filename: "downloadHistory.csv",
        conflictAction: "overwrite",
        saveAs: true
      }, (downloadId) => {
        setTimeout(() => URL.revokeObjectURL(urlBlob), 10000);
      });
    });
  });


  // CSVインポート処理
  const csvInput = document.getElementById("csvInput");
  document.getElementById("btn-import").addEventListener("click", function () {
    csvInput.click();
  });
  csvInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
      const text = event.target.result;
      importCSV(text);
    };
    reader.readAsText(file, "UTF-8");
  });

  // CSVをパースしてchrome.storage.localに追記する関数
  function importCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return;
    // ヘッダー判定: 1行目が "URL","timestamp","boothID","title","fileName","free" なら独自形式
    let headerLine = lines[0].trim().replace(/^\uFEFF/, '');
    const headerColumns = headerLine.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').trim());
    let importedEntries = [];
    if (headerColumns.join(',') === "URL,timestamp,boothID,title,fileName,free") {
      // 新形式
      for (let i = 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        if (columns.length < 6) {
          console.error("CSVインポート: カラム数不足", line);
          continue;
        }
        const urlField = columns[0].replace(/^"|"$/g, '').trim();
        const timestamp = columns[1].replace(/^"|"$/g, '').trim();
        const boothID = columns[2].replace(/^"|"$/g, '').trim();
        const title = columns[3].replace(/^"|"$/g, '').trim();
        const fileName = columns[4].replace(/^"|"$/g, '').trim();
        // free属性は新形式の場合も、CSV側の値をそのまま利用
        const free = columns[5].replace(/^"|"$/g, '').trim().toLowerCase() === "true";
        importedEntries.push({ url: urlField, timestamp, boothID, title, filename: fileName, free });
      }
    } else {
      // 従来形式のCSVパース処理（改良版）
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        // 最初の行でboothIDが抽出できなければヘッダー行とみなしスキップ
        const tempIdMatch = line.match(/\/items\/(\d+)/);
        if (i === 0 && (!tempIdMatch || !tempIdMatch[1])) {
          continue;
        }
        // 改良版正規表現: 各フィールド内でダブルクオートが現れる場合、""として許容する
        const match = line.match(/^\s*"((?:[^"]|"")*)"\s*,\s*"((?:[^"]|"")*)"\s*$/);
        if (!match) {
          console.error("CSVインポート従来形式: パース失敗", line);
          continue;
        }
        // 各フィールド内の""を"に置換
        const urlField = match[1].replace(/""/g, '"');
        const manageName = match[2].replace(/""/g, '"');

        const idMatch = urlField.match(/\/items\/(\d+)/);
        const boothID = idMatch ? idMatch[1] : null;
        if (!boothID) {
          console.error("CSVインポート従来形式: boothID抽出失敗", urlField);
          continue;
        }
        const tsMatch = manageName.match(/^\s*\[([^\]]+)\]/);
        const timestamp = tsMatch ? tsMatch[1] : "";
        let rest = manageName.replace(/^\s*\[[^\]]+\]\s*/, "");
        const lastSlashIndex = rest.lastIndexOf("/");
        let title = lastSlashIndex !== -1 ? rest.substring(0, lastSlashIndex).trim() : rest.trim();
        const free = true;
        importedEntries.push({ url: urlField, timestamp, boothID, title, filename: "", free });
      }
    }
    // 既存の履歴とマージ（重複判定は boothID と filename で行う）
    chrome.storage.local.get("downloadHistory", function (result) {
      let history = result.downloadHistory || [];
      importedEntries.forEach(newEntry => {
        // まず、同じ boothID のエントリについて、マージ条件でフィルタする
        history = history.filter(existing => {
          if (existing.boothID !== newEntry.boothID) {
            return true; // boothIDが異なるならそのまま残す
          }
          const newFN = (newEntry.filename || "").trim();
          const existFN = (existing.filename || "").trim();
          if (newFN === "" && existFN === "") {
            // 両方とも空の場合は重複とする（既存を削除）
            return false;
          } else if (newFN === "" && existFN !== "") {
            // newEntryは空で既存はnon-empty → 既存を優先するので新Entryは追加しない（既存はそのまま残す）
            return true;
          } else if (newFN !== "" && existFN === "") {
            // newEntryはnon-emptyで既存が空 → 既存を削除
            return false;
          } else {
            // 両方non-empty：同じなら重複（削除）、異なるなら別のエントリとして残す
            return newFN !== existFN;
          }
        });
        // さらに、もし newEntry の filename が空で、既に同じ boothID のエントリで non-empty filename が存在する場合は、newEntry を追加しない
        if ((newEntry.filename || "").trim() === "") {
          const existsNonEmpty = history.some(entry => entry.boothID === newEntry.boothID && (entry.filename || "").trim() !== "");
          if (existsNonEmpty) {
            return; // スキップして新Entryを追加しない
          }
        }
        history.push(newEntry);
      });
      chrome.storage.local.set({ downloadHistory: history }, function () {
        renderHistory();
      });
    });
  }


  // 履歴全削除ボタン
  document.getElementById("btn-clear").addEventListener("click", function () {
    if (confirm(chrome.i18n.getMessage("confirmClearHistory"))) {
      chrome.storage.local.remove("downloadHistory", function () {
        renderHistory();
      });
    }
  });

  // 選択削除ボタン
  document.getElementById("btn-selectclear").addEventListener("click", function () {
    if (confirm(chrome.i18n.getMessage("confirmSelectClearHistory"))) {
      chrome.storage.local.get("downloadHistory", function (result) {
        let history = result.downloadHistory || [];
        history = history.filter(entry => !entry.deleted);
        chrome.storage.local.set({ downloadHistory: history }, function () {
          renderHistory();
        });
      });
    }
  });

  // リロードボタン
  document.getElementById("reload").addEventListener("click", function () {
    chrome.storage.local.get("downloadHistory", function (result) {
      let history = result.downloadHistory || [];
      let updated = false;
      for (let i = 0; i < history.length; i++) {
        if (history[i].free === undefined || history[i].free === null || history[i].free === "") {
          history[i].free = false;
          updated = true;
        }
      }
      if (updated) {
        chrome.storage.local.set({ downloadHistory: history }, function () {
          renderHistory();
        });
      } else {
        renderHistory();
      }
    });
  });


  const uiLang = chrome.i18n.getUILanguage();
  let feedbackUrl;
  if (uiLang.startsWith("en")) {
    feedbackUrl = "https://forms.gle/U6GDvbx5n3zDRpTh9";  // 英語用のURL
  } else {
    feedbackUrl = "https://forms.gle/otwhoXKzc5EQQDti8";  // 日本語用のURL
  }
  document.getElementById("feedback-button").href = feedbackUrl;

  // 同一IDのアイテムをまとめるチェックボックスの状態変更イベント
  document.getElementById('toggleGroup').addEventListener('change', function () {
    const bulkRegisterToggle = document.getElementById('bulkRegisterToggle');
    bulkRegisterToggle.style.display = this.checked ? 'flex' : 'none';
    if (!this.checked) {
      document.getElementById('toggleBulkRegister').checked = false;
    }
  });

  // 初期表示時の状態を反映
  const groupCheckbox = document.getElementById('toggleGroup');
  const bulkRegisterToggle = document.getElementById('bulkRegisterToggle');
  bulkRegisterToggle.style.display = groupCheckbox.checked ? 'flex' : 'none';
});
