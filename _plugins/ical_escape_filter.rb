# Jekyll custom filter for iCalendar escaping
module Jekyll
  module IcalEscapeFilter
    def ical_escape(input)
      return "" if input.nil?
      input.to_s
        .gsub('\\', '\\\\') # Escape backslash
        .gsub(';', '\\;')      # Escape semicolon
        .gsub(',', '\\,')      # Escape comma
        .gsub(/\r?\n/, '\\n') # Escape newlines
    end
  end
end
Liquid::Template.register_filter(Jekyll::IcalEscapeFilter)
