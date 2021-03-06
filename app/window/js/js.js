const fs = require('fs')
const path = require('path')
const { ipcRenderer } = require('electron')

class Injector {
  constructor () {
    this.initialize()
  }

  // 初始化
  initialize () {
    // 只要loading结束
    // 不论页面加载是否成功都会执行
    window.addEventListener('load', () => {
      this.injectCss()
      this.injectJs()
    })
  }

  // 注入CSS
  injectCss () {
    let filename = path.join(__dirname, '../css/css.css')
    fs.readFile(filename, (err, css) => {
      if (!err) {
        const style = document.createElement('style')
        const styleContent = document.createTextNode(css.toString())
        style.appendChild(styleContent)
        document.head.appendChild(style)
      }
    })
  }

  // 注入JS
  injectJs () {
    /**
     * 插入窗口操作按钮
     * 关闭/最大化/最小化
     */
    this.createWindowOperation()

    /**
     * 检测是否有未读消息
     * 发送未读消息条数到主进程
     */
    this.setBadgeCount()

    /**
     * 打开邮箱界面
     */
    this.openEmail()
  }

  // 插入窗口操作按钮
  createWindowOperation () {
    const $ul = document.createElement('ul')
    $ul.setAttribute('class', 'dingtalk-window-operations')

    // 按钮className，同时也是事件名称
    const li = ['window-close', 'window-maximization', 'window-minimize']
    li.forEach(item => {
      // 创建按钮
      const $li = document.createElement('li')
      $li.setAttribute('class', `operation-button ${item}`)
      $ul.appendChild($li)

      // 点击按钮通知主进程
      $li.addEventListener('click', () => {
        ipcRenderer.send(item)
      })
    })
    // 把生成的按钮添加到DOM
    const $layoutContainer = document.querySelector('#layout-container')
    if ($layoutContainer) {
      document.body.insertBefore($ul, $layoutContainer.nextSibling)
    } else {
      document.body.appendChild($ul)
    }
  }

  // 消息通知发送到主进程
  setBadgeCount () {
    let oldCount = 0
    let notify = null
    setInterval(() => {
      let count = 0
      const $mainMenus = document.querySelector('#menu-pannel>.main-menus')
      if ($mainMenus) {
        const $menuItems = $mainMenus.querySelectorAll('li.menu-item')
        $menuItems.forEach($item => {
          const $unread = $item.querySelector('all-conv-unread-count em.ng-binding')
          if ($unread) {
            const badge = parseInt($unread.innerText)
            count += isNaN(badge) ? 0 : badge
          }
        })
      }
      if (oldCount !== count) {
        // 当有新消息来时才发送提示信息
        if (count !== 0 && oldCount < count) {
          // 关闭上一条消息提示
          if (notify && typeof notify.close === 'function') {
            notify.close()
          }
          notify = new Notification('钉钉', {
            body: `您有${count}条消息未查收`,
            tag: 'notify'
          })

          // linux上不支持点击事件
          notify.addEventListener('click', () => {
            ipcRenderer.send('window-show')
          })
        }
        oldCount = count
        ipcRenderer.send('set-badge', count)
      }
    }, 2000)
  }

  openEmail () {
    document.addEventListener('click', e => {
      const $email = document.querySelector('#menu-pannel > ul.extra-options.ng-scope > div > org-email > li')
      if (!$email) {
        return
      }
      if ($email.contains(e.target)) {
        // 停止事件冒泡和默认事件
        e.stopPropagation()
        e.preventDefault()
        const reg = /^\d+_mailUrl/
        const storage = localStorage
        for (let key in storage) {
          if (reg.test(key)) {
            ipcRenderer.send('open-email', storage[key])
            break
          }
        }
      }
    })
  }
}

new Injector()
