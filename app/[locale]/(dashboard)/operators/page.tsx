import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Users,
    Car,
    MapPin,
    Clock,
    ArrowRight,
    Truck,
    Navigation,
    AlertTriangle,
    CheckCircle,
    TrendingUp,
    Activity
} from "lucide-react"
import Link from "next/link"

export default function OperatorsPage() {
    const t = useTranslations('operators')

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Operators Dashboard</h1>
                    <p className="text-muted-foreground">
                        Manage student transportation operations and monitor real-time activities
                    </p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1,247</div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <TrendingUp className="h-3 w-3" />
                            +12% from last month
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Vehicles</CardTitle>
                        <Car className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">18</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Activity className="h-3 w-3" />
                            6 vehicles available
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Routes</CardTitle>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">24</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Navigation className="h-3 w-3" />
                            Morning & afternoon
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Status</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Online</div>
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            All systems operational
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Navigation Cards */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Allocator Section */}
                <Card className="relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-yankees-blue"></div>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Users className="h-6 w-6 text-yankees-blue" />
                            <CardTitle className="text-xl">Allocator</CardTitle>
                        </div>
                        <CardDescription>
                            Assign students to vehicles and manage pickup/dropoff routes
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-2xl font-bold text-yankees-blue">32</p>
                                <p className="text-xs text-muted-foreground">Active Routes</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-2xl font-bold">94%</p>
                                <p className="text-xs text-muted-foreground">Route Efficiency</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Assigned Students</span>
                                <span className="font-medium">1,244/1,247</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-yankees-blue h-2 rounded-full" style={{ width: '99.8%' }}></div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Link href="/operators/allocator">
                                <Button className="w-full gap-2 bg-yankees-blue hover:bg-yankees-blue/90">
                                    Open Allocator
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Dispatcher Section */}
                <Card className="relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-2 bg-green-600"></div>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Truck className="h-6 w-6 text-green-600" />
                            <CardTitle className="text-xl">Dispatcher</CardTitle>
                        </div>
                        <CardDescription>
                            Monitor real-time vehicle locations and coordinate operations
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-2xl font-bold text-green-600">18</p>
                                <p className="text-xs text-muted-foreground">Vehicles Online</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-2xl font-bold">432</p>
                                <p className="text-xs text-muted-foreground">Students in Transit</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Route Completion</span>
                                <span className="font-medium">67%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-green-600 h-2 rounded-full" style={{ width: '67%' }}></div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Link href="/operators/dispatcher">
                                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                                    Open Dispatcher
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                        Latest updates from transportation operations
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 pb-3 border-b">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium">Route A-Morning completed successfully</p>
                                <p className="text-xs text-muted-foreground">32 students delivered • Driver: John Smith</p>
                                <p className="text-xs text-muted-foreground">2 minutes ago</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 pb-3 border-b">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100">
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium">BUS-002 experiencing minor delay</p>
                                <p className="text-xs text-muted-foreground">Traffic congestion on Highway 441 • ETA +5 minutes</p>
                                <p className="text-xs text-muted-foreground">8 minutes ago</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 pb-3 border-b">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                                <Users className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium">3 new students assigned to Route C</p>
                                <p className="text-xs text-muted-foreground">Allocator updated assignments for afternoon routes</p>
                                <p className="text-xs text-muted-foreground">15 minutes ago</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yankees-blue/10">
                                <Navigation className="h-4 w-4 text-yankees-blue" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium">Route optimization completed</p>
                                <p className="text-xs text-muted-foreground">New routes will be effective tomorrow morning</p>
                                <p className="text-xs text-muted-foreground">1 hour ago</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
