# Jekyll custom filter to add one hour to a datetime string in UTC (for DTEND)
require 'time'

module Jekyll
  module AddHourFilter
    def add_hour_utc(input)
      return "" if input.nil?
      t = Time.parse(input.to_s)
      (t + 3600).utc.strftime("%Y%m%dT%H%M%SZ")
    rescue ArgumentError
      ""
    end
  end
end
Liquid::Template.register_filter(Jekyll::AddHourFilter)
