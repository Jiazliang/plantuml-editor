
export interface Template {
  name: string;
  code: string;
}

export const TEMPLATES: Record<string, Template> = {
  sequence: {
    name: "时序图 (Sequence)",
    code: `@startuml
skinparam theme plain
actor 用户 as User
participant "前端应用" as Client
participant "后端服务" as Server
database "数据库" as DB

User -> Client : 点击登录按钮
activate Client
Client -> Server : 发送登录请求 (POST /login)
activate Server
Server -> DB : 查询用户信息
activate DB
DB --> Server : 返回用户数据
deactivate DB
Server --> Client : 返回 Token
deactivate Server
Client --> User : 跳转至主页
deactivate Client
@enduml`
  },
  usecase: {
    name: "用例图 (Use Case)",
    code: `@startuml
skinparam theme plain
left to right direction
actor "普通用户" as User
actor "管理员" as Admin

package "电商系统" {
  usecase "浏览商品" as UC1
  usecase "加入购物车" as UC2
  usecase "下单支付" as UC3
  usecase "管理订单" as UC4
  usecase "上架商品" as UC5
}

User --> UC1
User --> UC2
User --> UC3
Admin --> UC4
Admin --> UC5
@enduml`
  },
  class: {
    name: "类图 (Class)",
    code: `@startuml
skinparam theme plain
class 用户 {
  +String 姓名
  +String 邮箱
  +Boolean 登录()
  +void 注销()
}

class 订单 {
  +String 订单号
  +Date 创建日期
  +void 支付()
}

class 商品 {
  +String 名称
  +Float 价格
}

用户 "1" -- "*" 订单 : 下单 >
订单 "*" *-- "1..*" 商品 : 包含 >
@enduml`
  },
  activity: {
    name: "活动图 (Activity)",
    code: `@startuml
skinparam theme plain
start
:接收订单请求;
if (库存充足?) then (是)
  :锁定库存;
  :创建支付订单;
  if (支付成功?) then (是)
    :生成发货单;
    :发送确认邮件;
  else (否)
    :释放库存;
    :取消订单;
  endif
else (否)
  :提示库存不足;
endif
stop
@enduml`
  },
  component: {
    name: "组件图 (Component)",
    code: `@startuml
skinparam theme plain

package "前端" {
  [Web 应用] as Web
  [移动 App] as App
}

package "后端" {
  component [API 网关] as Gateway
  component [认证服务] as Auth
  component [订单服务] as Order
  interface "REST API" as Rest
}

database "PostgreSQL" as DB

Web --> Rest
App --> Rest
Rest - Gateway
Gateway --> Auth
Gateway --> Order
Order --> DB
@enduml`
  },
  deployment: {
    name: "部署图 (Deployment)",
    code: `@startuml
skinparam theme plain

node "客户端" {
    artifact "Web 浏览器"
}

cloud "阿里云/AWS" {
    node "负载均衡器" as LB
    
    node "应用服务器集群" {
        component "后端 API" as API
    }
    
    node "数据库服务器" {
        database "Redis 缓存"
        database "MySQL 主库"
    }
}

[Web 浏览器] --> LB : HTTPS
LB --> API
API --> [Redis 缓存]
API --> [MySQL 主库]
@enduml`
  },
  state: {
    name: "状态图 (State)",
    code: `@startuml
skinparam theme plain
[*] --> 待支付
待支付 --> 已支付 : 支付成功
待支付 --> 已取消 : 超时/手动取消
已支付 --> 待发货 : 商家确认
待发货 --> 已发货 : 物流揽收
已发货 --> 已签收 : 用户确认
已签收 --> [*]
已取消 --> [*]
@enduml`
  },
  object: {
    name: "对象图 (Object)",
    code: `@startuml
skinparam theme plain

object "管理员: 用户" as admin {
  id = 1
  name = "张三"
  role = "admin"
}

object "开发部: 部门" as dept {
  id = 101
  name = "研发中心"
  location = "北京"
}

admin --> dept : 所属 >
@enduml`
  },
  mindmap: {
    name: "思维导图 (MindMap)",
    code: `@startmindmap
skinparam theme plain
* 软件开发生命周期
** 需求分析
*** 用户访谈
*** 市场调研
** 系统设计
*** 架构设计
*** 数据库设计
** 开发实施
*** 前端开发
*** 后端开发
** 测试验收
*** 单元测试
*** 集成测试
** 部署上线
*** CI/CD
*** 监控运维
@endmindmap`
  },
  wbs: {
    name: "工作分解结构 (WBS)",
    code: `@startwbs
skinparam theme plain
* 网站重构项目
** 规划阶段
*** 确定目标
*** 预算审批
** 设计阶段
*** 原型设计
*** UI 设计
** 开发阶段
*** 前端实现
*** 后端接口
** 测试阶段
*** 功能测试
*** 性能测试
@endwbs`
  },
  gantt: {
    name: "甘特图 (Gantt)",
    code: `@startgantt
skinparam theme plain
language zh
Project starts 2024-01-01
[需求调研] lasts 10 days
[UI设计] lasts 15 days
[后端开发] lasts 20 days
[前端对接] lasts 10 days

[需求调研] is colored in DeepSkyBlue
[UI设计] starts at [需求调研]'s end
[后端开发] starts at [需求调研]'s end
[前端对接] starts at [UI设计]'s end
@endgantt`
  },
  timing: {
    name: "定时图 (Timing)",
    code: `@startuml
skinparam theme plain
robust "DNS 解析" as DNS
robust "TCP 连接" as TCP
concise "HTTP 请求" as HTTP

@0
DNS is Idle
TCP is Idle
HTTP is Idle

@100
DNS is Processing

@300
DNS is Idle
TCP is Connecting

@500
TCP is Connected
HTTP is Waiting

@600
HTTP is "GET /index.html"

@800
HTTP is Idle
@enduml`
  },
  er: {
    name: "ER 图 (Entity Relationship)",
    code: `@startuml
skinparam theme plain

' hide the circle
hide circle

' avoid problems with angled crows feet
skinparam linetype ortho

entity "用户 (User)" as user {
  *id : number <<generated>>
  --
  *name : text
  description : text
}

entity "订单 (Order)" as order {
  *id : number <<generated>>
  --
  *user_id : number <<FK>>
  *total : number
}

entity "订单明细 (LineItem)" as item {
  *id : number <<generated>>
  --
  *order_id : number <<FK>>
  *product_id : number
  *quantity : number
}

user ||..o{ order
order ||..|{ item
@enduml`
  },
  network: {
    name: "网络图 (Network/nwdiag)",
    code: `@startuml
nwdiag {
  network 核心网段 {
    address = "192.168.10.0/24"

    web01 [address = "192.168.10.10"];
    web02 [address = "192.168.10.11"];
  }
  network 数据库网段 {
    address = "192.168.20.0/24"

    web01;
    web02;
    db01 [address = "192.168.20.101"];
  }
}
@enduml`
  },
  salt: {
    name: "UI 线框图 (Salt)",
    code: `@startsalt
{
  Login | "                "
  Password | "****            "
  [Cancel] | [  Log In  ]
}
@endsalt`
  },
  archimate: {
    name: "Archimate 企业架构",
    code: `@startuml
skinparam theme plain
sprite $bProcess jar:archimate/business-process
sprite $aService jar:archimate/application-service
sprite $aComponent jar:archimate/application-component

rectangle "处理索赔"  as BP1 <<$bProcess>> #Business
rectangle "索赔管理服务" as AS1 <<$aService>> #Application
rectangle "CRM 系统" as AC1 <<$aComponent>> #Application

BP1 -down-> AS1
AS1 -down-> AC1
@enduml`
  },
  json: {
    name: "JSON 可视化",
    code: `@startjson
#highlight "config"
{
  "appName": "PlantUML Editor",
  "version": "2.0.0",
  "config": {
    "theme": "dark",
    "autoSave": true,
    "plugins": [
      "markdown",
      "csv-export"
    ]
  },
  "users": [
    {"id": 1, "name": "Alice", "role": "admin"},
    {"id": 2, "name": "Bob", "role": "user"}
  ]
}
@endjson`
  },
  yaml: {
    name: "YAML 可视化",
    code: `@startyaml
#highlight "services"
version: '3'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: secret
@endyaml`
  }
};
